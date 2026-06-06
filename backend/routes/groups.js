import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

const getGroupWithMembers = async (groupId) => {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name, created_by, created_at')
    .eq('id', groupId)
    .single();

  if (groupError) {
    throw new Error(groupError.message);
  }

  const { data: members, error: membersError } = await supabase
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

  if (membersError) {
    throw new Error(membersError.message);
  }

  return {
    ...group,
    members: members.map(member => member.users)
  };
};

const ensureGroupMember = async (groupId, userId) => {
  const { data: membership, error } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(membership);
};

const roundMoney = (amount) => Math.round(Number(amount || 0) * 100) / 100;

const groupHasPendingBalance = async (groupId) => {
  const [membersResult, expensesResult, proofsResult] = await Promise.all([
    supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId),
    supabase
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
      .eq('group_id', groupId),
    supabase
      .from('settlement_proofs')
      .select('payer_id, receiver_id, amount')
      .eq('group_id', groupId)
      .eq('status', 'approved')
  ]);

  if (membersResult.error) throw new Error(membersResult.error.message);
  if (expensesResult.error) throw new Error(expensesResult.error.message);
  if (proofsResult.error) throw new Error(proofsResult.error.message);

  const balances = {};
  (membersResult.data || []).forEach(member => {
    balances[member.user_id] = 0;
  });

  (expensesResult.data || []).forEach(expense => {
    expense.expense_payers?.forEach(payer => {
      balances[payer.user_id] = (balances[payer.user_id] || 0) + Number(payer.amount_paid || 0);
    });

    expense.expense_splits?.forEach(split => {
      balances[split.user_id] = (balances[split.user_id] || 0) - Number(split.amount_owed || 0);
    });
  });

  (proofsResult.data || []).forEach(proof => {
    balances[proof.payer_id] = (balances[proof.payer_id] || 0) + Number(proof.amount || 0);
    balances[proof.receiver_id] = (balances[proof.receiver_id] || 0) - Number(proof.amount || 0);
  });

  return Object.values(balances).some(balance => Math.abs(roundMoney(balance)) > 0.009);
};

// Get all groups for logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: groups, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        groups (
          id,
          name,
          created_by,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const groupsWithMembers = await Promise.all(
      groups.map(async (gm) => {
        const group = gm.groups;
        const { data: members, error: membersError } = await supabase
          .from('group_members')
          .select(`
            user_id,
            users (
              id,
              email,
              name
            )
          `)
          .eq('group_id', group.id);

        if (membersError) {
          throw new Error(membersError.message);
        }

        return {
          ...group,
          members: members.map(member => member.users)
        };
      })
    );

    res.json(groupsWithMembers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific group with members
router.get('/:groupId', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    res.json(await getGroupWithMembers(groupId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new group
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, member_emails } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Group name required' });
    }

    const normalizedEmails = Array.isArray(member_emails)
      ? [...new Set(member_emails.map(email => email.trim().toLowerCase()).filter(Boolean))]
      : [];

    if (normalizedEmails.length < 1) {
      return res.status(400).json({ error: 'Add at least 1 registered member email' });
    }

    const { data: requestedMembers, error: requestedMembersError } = await supabase
      .from('users')
      .select('id, email, name')
      .in('email', normalizedEmails);

    if (requestedMembersError) {
      return res.status(500).json({ error: requestedMembersError.message });
    }

    const foundEmails = new Set((requestedMembers || []).map(member => member.email.toLowerCase()));
    const missingEmails = normalizedEmails.filter(email => !foundEmails.has(email));

    if (missingEmails.length > 0) {
      return res.status(400).json({
        error: `These users are not registered yet: ${missingEmails.join(', ')}`,
        missing_emails: missingEmails
      });
    }

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert([{ name, created_by: userId }])
      .select('id, name, created_by, created_at')
      .single();

    if (groupError) {
      return res.status(500).json({ error: groupError.message });
    }

    const memberIds = [...new Set([userId, ...requestedMembers.map(member => member.id)])];
    const memberRecords = memberIds.map(memberId => ({
      group_id: group.id,
      user_id: memberId
    }));

    const { error: memberInsertError } = await supabase
      .from('group_members')
      .insert(memberRecords);

    if (memberInsertError) {
      return res.status(500).json({ error: memberInsertError.message });
    }

    res.json({ 
      message: 'Group created successfully',
      group: await getGroupWithMembers(group.id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a registered user to an existing group
router.post('/:groupId/members', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Member email is required' });
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const { data: userToAdd, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .single();

    if (userError || !userToAdd) {
      return res.status(400).json({ error: `User is not registered yet: ${normalizedEmail}` });
    }

    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userToAdd.id)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({ error: `${normalizedEmail} is already in this group` });
    }

    const { error: insertError } = await supabase
      .from('group_members')
      .insert([{ group_id: groupId, user_id: userToAdd.id }]);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    res.json({
      message: 'Member added successfully',
      group: await getGroupWithMembers(groupId)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a group only when all payments are settled.
router.delete('/:groupId', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, created_by')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.created_by !== userId) {
      return res.status(403).json({ error: 'Only the group creator can delete this group' });
    }

    if (await groupHasPendingBalance(groupId)) {
      return res.status(400).json({ error: 'Cannot delete group while payments are pending' });
    }

    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get chat messages for a group
router.get('/:groupId/messages', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const isMember = await ensureGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data: messages, error } = await supabase
      .from('group_messages')
      .select(`
        id,
        group_id,
        user_id,
        message,
        created_at,
        users (
          id,
          email,
          name
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(messages || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a chat message in a group
router.post('/:groupId/messages', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const message = req.body.message?.trim();

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const isMember = await ensureGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data: insertedMessage, error } = await supabase
      .from('group_messages')
      .insert([{ group_id: groupId, user_id: userId, message }])
      .select(`
        id,
        group_id,
        user_id,
        message,
        created_at,
        users (
          id,
          email,
          name
        )
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: 'Message sent successfully',
      chat_message: insertedMessage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
