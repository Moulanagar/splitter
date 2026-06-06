import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

const roundMoney = (amount) => Math.round(Number(amount || 0) * 100) / 100;

const calculateSettlements = (balances) => {
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([userId, balance]) => {
    const roundedBalance = roundMoney(balance);

    if (roundedBalance < -0.009) {
      debtors.push({ userId, amount: Math.abs(roundedBalance) });
    } else if (roundedBalance > 0.009) {
      creditors.push({ userId, amount: roundedBalance });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.009) {
      settlements.push({
        payer_id: debtor.userId,
        receiver_id: creditor.userId,
        amount: roundMoney(amount)
      });
    }

    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);

    if (debtor.amount <= 0.009) debtorIndex += 1;
    if (creditor.amount <= 0.009) creditorIndex += 1;
  }

  return settlements;
};

const getUserGroups = async (userId) => {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      groups (
        id,
        name,
        created_at
      )
    `)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(row => row.groups).filter(Boolean);
};

const getGroupMembers = async (groupId) => {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      user_id,
      users (
        id,
        email,
        name
      )
    `)
    .eq('group_id', groupId);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(row => row.users).filter(Boolean);
};

const getGroupExpenses = async (groupId) => {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id,
      expense_payers (
        user_id,
        amount_paid
      ),
      expense_splits (
        user_id,
        amount_owed
      )
    `)
    .eq('group_id', groupId);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

const getGroupProofs = async (groupId) => {
  const { data, error } = await supabase
    .from('settlement_proofs')
    .select('id, group_id, payer_id, receiver_id, amount, proof_text, status, created_at, reviewed_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

const getLatestProof = (proofs, payerId, receiverId) => (
  proofs.find(proof => proof.payer_id === payerId && proof.receiver_id === receiverId) || null
);

const calculateGroupSettlementData = async (group) => {
  const [members, expenses, proofs] = await Promise.all([
    getGroupMembers(group.id),
    getGroupExpenses(group.id),
    getGroupProofs(group.id)
  ]);

  const usersById = {};
  const balances = {};

  members.forEach(member => {
    usersById[member.id] = member;
    balances[member.id] = 0;
  });

  expenses.forEach(expense => {
    expense.expense_payers?.forEach(payer => {
      balances[payer.user_id] = (balances[payer.user_id] || 0) + Number(payer.amount_paid || 0);
    });

    expense.expense_splits?.forEach(split => {
      balances[split.user_id] = (balances[split.user_id] || 0) - Number(split.amount_owed || 0);
    });
  });

  proofs
    .filter(proof => proof.status === 'approved')
    .forEach(proof => {
      balances[proof.payer_id] = (balances[proof.payer_id] || 0) + Number(proof.amount || 0);
      balances[proof.receiver_id] = (balances[proof.receiver_id] || 0) - Number(proof.amount || 0);
    });

  return {
    usersById,
    proofs,
    settlements: calculateSettlements(balances)
  };
};

// Dashboard settlement items for the current user.
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await getUserGroups(userId);
    const items = [];

    for (const group of groups) {
      const { usersById, proofs, settlements } = await calculateGroupSettlementData(group);

      settlements.forEach(settlement => {
        if (settlement.payer_id !== userId && settlement.receiver_id !== userId) {
          return;
        }

        const proof = getLatestProof(proofs, settlement.payer_id, settlement.receiver_id);
        const isPayer = settlement.payer_id === userId;

        items.push({
          group,
          payer: usersById[settlement.payer_id],
          receiver: usersById[settlement.receiver_id],
          amount: settlement.amount,
          role: isPayer ? 'payer' : 'receiver',
          proof
        });
      });

      proofs
        .filter(proof => proof.status !== 'approved')
        .filter(proof => proof.payer_id === userId || proof.receiver_id === userId)
        .forEach(proof => {
          const alreadyIncluded = items.some(item => item.proof?.id === proof.id);

          if (!alreadyIncluded) {
            items.push({
              group,
              payer: usersById[proof.payer_id],
              receiver: usersById[proof.receiver_id],
              amount: Number(proof.amount),
              role: proof.payer_id === userId ? 'payer' : 'receiver',
              proof
            });
          }
        });
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approved settlement proofs for a group, used to reduce group balances.
router.get('/group/:groupId/proofs', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data: proofs, error } = await supabase
      .from('settlement_proofs')
      .select('id, group_id, payer_id, receiver_id, amount, proof_text, status, created_at, reviewed_at')
      .eq('group_id', groupId)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(proofs || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit proof for a settlement payment.
router.post('/proofs', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { group_id, receiver_id, amount, proof_text } = req.body;
    const parsedAmount = Number(amount);

    if (!group_id || !receiver_id || !parsedAmount || !proof_text?.trim()) {
      return res.status(400).json({ error: 'Group, receiver, amount, and proof are required' });
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data: receiverMembership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', receiver_id)
      .maybeSingle();

    if (!receiverMembership) {
      return res.status(400).json({ error: 'Receiver is not in this group' });
    }

    const { data: proof, error } = await supabase
      .from('settlement_proofs')
      .insert([{
        group_id,
        payer_id: userId,
        receiver_id,
        amount: roundMoney(parsedAmount),
        proof_text: proof_text.trim(),
        status: 'pending'
      }])
      .select('id, group_id, payer_id, receiver_id, amount, proof_text, status, created_at, reviewed_at')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: 'Proof submitted successfully',
      proof
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receiver approves or denies a proof.
router.patch('/proofs/:proofId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { proofId } = req.params;
    const { status } = req.body;

    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or denied' });
    }

    const { data: proof, error: proofError } = await supabase
      .from('settlement_proofs')
      .select('id, receiver_id, status')
      .eq('id', proofId)
      .single();

    if (proofError || !proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }

    if (proof.receiver_id !== userId) {
      return res.status(403).json({ error: 'Only the receiver can review this proof' });
    }

    if (proof.status === 'approved') {
      return res.status(400).json({ error: 'This proof has already been approved' });
    }

    const { data: updatedProof, error } = await supabase
      .from('settlement_proofs')
      .update({
        status,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', proofId)
      .select('id, group_id, payer_id, receiver_id, amount, proof_text, status, created_at, reviewed_at')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: `Proof ${status}`,
      proof: updatedProof
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
