import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get expenses for a group
router.get('/group/:groupId', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select(`
        id,
        group_id,
        description,
        total_amount,
        created_at,
        expense_payers (
          user_id,
          amount_paid,
          users (id, email, name)
        ),
        expense_splits (
          user_id,
          amount_owed,
          users (id, email, name)
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add expense to group
router.post('/', verifyToken, async (req, res) => {
  try {
    const { group_id, description, total_amount, payers, splits } = req.body;

    if (!group_id || !description || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const activePayers = Array.isArray(payers)
      ? payers.filter(p => Number(p.amount_paid) > 0)
      : [];
    const activeSplits = Array.isArray(splits)
      ? splits.filter(s => Number(s.amount_owed) > 0)
      : [];

    if (activePayers.length === 0 || activeSplits.length === 0) {
      return res.status(400).json({ error: 'At least one payer and one borrower are required' });
    }

    const paidTotal = activePayers.reduce((sum, payer) => sum + Number(payer.amount_paid || 0), 0);
    const splitTotal = activeSplits.reduce((sum, split) => sum + Number(split.amount_owed || 0), 0);

    if (Math.abs(paidTotal - splitTotal) > 0.01 || Math.abs(Number(total_amount) - paidTotal) > 0.01) {
      return res.status(400).json({ error: 'Paid total and borrowed total must match' });
    }

    // Create expense
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert([{
        group_id,
        description,
        total_amount
      }])
      .select('id, group_id, description, total_amount, created_at')
      .single();

    if (expenseError) {
      return res.status(500).json({ error: expenseError.message });
    }

    // Add payers
    if (activePayers.length > 0) {
      const payerRecords = activePayers.map(p => ({
        expense_id: expense.id,
        user_id: p.user_id,
        amount_paid: Number(p.amount_paid)
      }));
      const { error: payerError } = await supabase
        .from('expense_payers')
        .insert(payerRecords);

      if (payerError) {
        return res.status(500).json({ error: payerError.message });
      }
    }

    // Add splits
    if (activeSplits.length > 0) {
      const splitRecords = activeSplits.map(s => ({
        expense_id: expense.id,
        user_id: s.user_id,
        amount_owed: Number(s.amount_owed)
      }));
      const { error: splitError } = await supabase
        .from('expense_splits')
        .insert(splitRecords);

      if (splitError) {
        return res.status(500).json({ error: splitError.message });
      }
    }

    res.json({ 
      message: 'Expense added successfully',
      expense 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
