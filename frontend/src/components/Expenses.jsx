import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/Expenses.css';

const Expenses = ({ groupId, user, refreshKey = 0 }) => {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [approvedSettlementProofs, setApprovedSettlementProofs] = useState([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [description, setDescription] = useState('');
  const [payers, setPayers] = useState({}); // { userId: amount }
  const [splits, setSplits] = useState({}); // { userId: amount }
  const [splitMode, setSplitMode] = useState('equal'); // 'equal' or 'custom'

  const createZeroAmountMap = (groupMembers) => {
    const amountMap = {};
    groupMembers.forEach(member => {
      amountMap[member.id] = 0;
    });
    return amountMap;
  };

  const createEqualSplitMap = (groupMembers, total) => {
    const splitMap = {};
    const splitAmount = groupMembers.length > 0 ? total / groupMembers.length : 0;

    groupMembers.forEach(member => {
      splitMap[member.id] = splitAmount;
    });

    return splitMap;
  };

  const getMemberName = (userId) => {
    const member = members.find(m => m.id === userId);
    return member?.name || member?.email || 'Unknown member';
  };

  const formatMoney = (amount) => `$${Number(amount || 0).toFixed(2)}`;

  const sumAmounts = (amounts) => (
    Object.values(amounts).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0)
  );

  const calculateNetBalances = (sourcePayers, sourceSplits) => {
    const balances = {};
    members.forEach(member => {
      balances[member.id] = 0;
    });

    Object.entries(sourcePayers).forEach(([userId, amount]) => {
      balances[userId] = (balances[userId] || 0) + (parseFloat(amount) || 0);
    });

    Object.entries(sourceSplits).forEach(([userId, amount]) => {
      balances[userId] = (balances[userId] || 0) - (parseFloat(amount) || 0);
    });

    return balances;
  };

  const calculateGroupBalances = () => {
    const balances = {};
    members.forEach(member => {
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

    approvedSettlementProofs.forEach(proof => {
      balances[proof.payer_id] = (balances[proof.payer_id] || 0) + Number(proof.amount || 0);
      balances[proof.receiver_id] = (balances[proof.receiver_id] || 0) - Number(proof.amount || 0);
    });

    return balances;
  };

  const calculateSettlements = (balances) => {
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
      const roundedBalance = Math.round(Number(balance || 0) * 100) / 100;

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
          from: debtor.userId,
          to: creditor.userId,
          amount: Math.round(amount * 100) / 100
        });
      }

      debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;
      creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;

      if (debtor.amount <= 0.009) debtorIndex += 1;
      if (creditor.amount <= 0.009) creditorIndex += 1;
    }

    return settlements;
  };

  const formTotalPaid = sumAmounts(payers);
  const formTotalOwed = sumAmounts(splits);
  const formBalancePreview = calculateNetBalances(payers, splits);
  const groupBalances = calculateGroupBalances();
  const groupSettlements = calculateSettlements(groupBalances);

  const fetchGroupData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch group members
      const { data: groupData } = await axios.get(
        `${process.env.REACT_APP_API_URL}/groups/${groupId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMembers(groupData.members || []);

      // Fetch expenses
      const { data: expenseData } = await axios.get(
        `${process.env.REACT_APP_API_URL}/expenses/group/${groupId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExpenses(expenseData);

      const { data: approvedProofData } = await axios.get(
        `${process.env.REACT_APP_API_URL}/settlements/group/${groupId}/proofs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setApprovedSettlementProofs(approvedProofData || []);

      // Every group member starts as a payer at 0 and a borrower in the split.
      const groupMembers = groupData.members || [];
      setPayers(createZeroAmountMap(groupMembers));
      setSplits(createEqualSplitMap(groupMembers, 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchApprovedSettlementProofs = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(
        `${process.env.REACT_APP_API_URL}/settlements/group/${groupId}/proofs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setApprovedSettlementProofs(data || []);
    } catch (err) {
      console.error(err);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData, refreshKey]);

  useEffect(() => {
    const intervalId = setInterval(fetchApprovedSettlementProofs, 6000);
    return () => clearInterval(intervalId);
  }, [fetchApprovedSettlementProofs]);

  // Recalculate equal splits when payers change
  useEffect(() => {
    if (splitMode === 'equal' && members.length > 0) {
      const totalPaid = sumAmounts(payers);
      const splitPerPerson = totalPaid / members.length;
      const newSplits = {};
      members.forEach(m => {
        newSplits[m.id] = splitPerPerson;
      });
      setSplits(newSplits);
    }
  }, [payers, splitMode, members]);

  const handlePayerChange = (userId, amount) => {
    setPayers(prev => ({
      ...prev,
      [userId]: parseFloat(amount) || 0
    }));
  };

  const handleSplitChange = (userId, amount) => {
    setSplits(prev => ({
      ...prev,
      [userId]: parseFloat(amount) || 0
    }));
  };

  const calculateEqualSplits = () => {
    const totalPaid = sumAmounts(payers);
    const split = totalPaid / members.length;
    const newSplits = {};
    members.forEach(m => {
      newSplits[m.id] = split;
    });
    return newSplits;
  };

  const handleSplitModeChange = (mode) => {
    setSplitMode(mode);
    if (mode === 'equal') {
      setSplits(calculateEqualSplits());
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();

    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }

    const activePayers = Object.entries(payers)
      .filter(([_, amount]) => amount > 0)
      .map(([userId, amount]) => ({ user_id: userId, amount_paid: parseFloat(amount) || 0 }));

    const activeSplits = Object.entries(splits)
      .filter(([_, amount]) => amount > 0)
      .map(([userId, amount]) => ({ user_id: userId, amount_owed: parseFloat(amount) || 0 }));

    if (activePayers.length === 0 || activeSplits.length === 0) {
      alert('Select at least one payer and one split recipient');
      return;
    }

    // Calculate total from payers
    const calculatedTotal = activePayers.reduce((sum, p) => sum + p.amount_paid, 0);
    const calculatedSplitTotal = activeSplits.reduce((sum, s) => sum + s.amount_owed, 0);

    if (Math.abs(calculatedTotal - calculatedSplitTotal) > 0.01) {
      alert('Total paid and total borrowed must match');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/expenses`,
        {
          group_id: groupId,
          description,
          total_amount: calculatedTotal,
          payers: activePayers,
          splits: activeSplits
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Reset form
      setDescription('');
      setPayers(createZeroAmountMap(members));
      setSplits(createEqualSplitMap(members, 0));
      setShowExpenseForm(false);

      // Refresh expenses
      await fetchGroupData();
      alert('Expense added successfully!');
    } catch (err) {
      alert('Failed to create expense: ' + (err.response?.data?.error || err.message));
      console.error(err);
    }
  };

  return (
    <div className="expenses-container">
      <div className="expenses-header">
        <div>
          <h2>Group Expenses</h2>
          <p className="members-summary">
            {members.length} member{members.length === 1 ? '' : 's'} in this group
          </p>
        </div>
        <button
          className="btn-add-expense"
          onClick={() => setShowExpenseForm(!showExpenseForm)}
        >
          {showExpenseForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      <div className="group-members-panel">
        <h3>Group Members</h3>
        {members.length === 0 ? (
          <p className="empty-state compact">No members loaded yet.</p>
        ) : (
          <div className="group-members-list">
            {members.map(member => (
              <div key={member.id} className="group-member-chip">
                <span>{member.name || member.email}</span>
                <small>{member.email}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      {showExpenseForm && (
        <form className="expense-form" onSubmit={handleCreateExpense}>
          <div className="form-section">
            <h3>Expense Details</h3>
            
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Dinner at restaurant"
                required
              />
            </div>

            {/* Total is auto-calculated from payers, but show it for reference */}
            <div className="form-group">
              <label>Total Amount (calculated from payers)</label>
              <input
                type="number"
                value={formTotalPaid.toFixed(2)}
                disabled
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Who Paid? (Case 2: Multiple Payers)</h3>
            <p className="help-text">Enter how much each person paid</p>
            {members.map(member => (
              <div key={member.id} className="member-input-row">
                <label>{member.name || member.email}</label>
                <input
                  type="number"
                  value={payers[member.id] || 0}
                  onChange={(e) => handlePayerChange(member.id, e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="amount-input"
                />
              </div>
            ))}
          </div>

          <div className="form-section">
            <h3>How to Split?</h3>
            <div className="split-mode-selector">
              <button
                type="button"
                className={`split-mode-btn ${splitMode === 'equal' ? 'active' : ''}`}
                onClick={() => handleSplitModeChange('equal')}
              >
                Equal Split
              </button>
              <button
                type="button"
                className={`split-mode-btn ${splitMode === 'custom' ? 'active' : ''}`}
                onClick={() => handleSplitModeChange('custom')}
              >
                Custom Split
              </button>
            </div>

            <p className="help-text">Who owes money?</p>
            {members.map(member => (
              <div key={member.id} className="member-input-row">
                <label>{member.name || member.email}</label>
                <input
                  type="number"
                  value={splits[member.id] || 0}
                  onChange={(e) => handleSplitChange(member.id, e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="amount-input"
                  disabled={splitMode === 'equal'}
                />
              </div>
            ))}
          </div>

          <div className="form-section">
            <h3>Balance Preview</h3>
            <p className="help-text">
              Positive means they should receive money. Negative means they should pay.
            </p>
            <div className="balance-preview-list">
              {members.map(member => {
                const balance = formBalancePreview[member.id] || 0;
                return (
                  <div key={member.id} className="balance-preview-row">
                    <span>{member.name || member.email}</span>
                    <strong className={balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                      {balance >= 0 ? '+' : ''}{formatMoney(balance)}
                    </strong>
                  </div>
                );
              })}
            </div>
            <div className="split-total-check">
              <span>Paid: {formatMoney(formTotalPaid)}</span>
              <span>Borrowed: {formatMoney(formTotalOwed)}</span>
            </div>
          </div>

          <button type="submit" className="btn btn-submit">
            Add Expense
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading expenses...</p>
      ) : expenses.length === 0 ? (
        <p className="empty-state">No expenses yet. Add one to get started!</p>
      ) : (
        <>
          <div className="balances-section">
            <h3>Current Balances</h3>
            <div className="balance-preview-list">
              {members.map(member => {
                const balance = groupBalances[member.id] || 0;
                return (
                  <div key={member.id} className="balance-preview-row">
                    <span>{member.name || member.email}</span>
                    <strong className={balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                      {balance >= 0 ? '+' : ''}{formatMoney(balance)}
                    </strong>
                  </div>
                );
              })}
            </div>

            <h3>Settle Up</h3>
            {groupSettlements.length === 0 ? (
              <p className="empty-state compact">Everyone is settled.</p>
            ) : (
              <div className="settlement-list">
                {groupSettlements.map((settlement, index) => (
                  <div key={`${settlement.from}-${settlement.to}-${index}`} className="settlement-row">
                    <span>{getMemberName(settlement.from)} pays {getMemberName(settlement.to)}</span>
                    <strong>{formatMoney(settlement.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="expenses-list">
            {expenses.map(expense => (
              <div key={expense.id} className="expense-card">
                <div className="expense-header-card">
                  <h4>{expense.description}</h4>
                  <span className="expense-amount">{formatMoney(expense.total_amount)}</span>
                </div>

                {expense.expense_payers && expense.expense_payers.length > 0 && (
                  <div className="expense-detail">
                    <p className="detail-label">Paid by:</p>
                    <div className="detail-items">
                      {expense.expense_payers.map((payer, idx) => (
                        <div key={idx} className="detail-item">
                          {payer.users.name || payer.users.email}: {formatMoney(payer.amount_paid)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expense.expense_splits && expense.expense_splits.length > 0 && (
                  <div className="expense-detail">
                    <p className="detail-label">Borrowed by:</p>
                    <div className="detail-items">
                      {expense.expense_splits.map((split, idx) => (
                        <div key={idx} className="detail-item">
                          {split.users.name || split.users.email}: {formatMoney(split.amount_owed)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="expense-date">
                  {new Date(expense.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Expenses;
