import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Expenses from './Expenses';
import GroupChat from './GroupChat';
import '../styles/Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [memberEmails, setMemberEmails] = useState(['']); // Minimum 2 people total: creator + 1 member
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [settlementsLoading, setSettlementsLoading] = useState(true);
  const [proofInputs, setProofInputs] = useState({});
  const [settlementActionLoading, setSettlementActionLoading] = useState('');
  const [deletingGroup, setDeletingGroup] = useState(false);
  const selectedGroupId = selectedGroup?.id;

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/groups`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const fetchedGroups = response.data || [];
      setGroups(fetchedGroups);
      setSelectedGroup(currentSelectedGroup => {
        if (!currentSelectedGroup) {
          const storedGroupId = localStorage.getItem('selectedGroupId');
          return fetchedGroups.find(group => group.id === storedGroupId) || null;
        }

        return fetchedGroups.find(group => group.id === currentSelectedGroup.id) || currentSelectedGroup;
      });
    } catch (err) {
      setError('Failed to load groups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettlements = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/settlements`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setSettlements(response.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSettlementsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchSettlements();

    const intervalId = setInterval(() => {
      fetchGroups();
      fetchSettlements();
    }, 7000);

    return () => clearInterval(intervalId);
  }, [fetchGroups, fetchSettlements]);

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    localStorage.setItem('selectedGroupId', group.id);
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    localStorage.removeItem('selectedGroupId');
    fetchGroups(); // Refresh groups in case expenses were added
  };

  const handleAddMemberField = () => {
    setMemberEmails([...memberEmails, '']);
  };

  const handleMemberEmailChange = (index, value) => {
    const newEmails = [...memberEmails];
    newEmails[index] = value;
    setMemberEmails(newEmails);
  };

  const formatMemberName = (member) => member?.name || member?.email || 'Unknown user';

  const formatMoney = (amount) => `$${Number(amount || 0).toFixed(2)}`;

  const getSettlementKey = (settlement) => (
    `${settlement.group.id}-${settlement.payer.id}-${settlement.receiver.id}`
  );

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    
    if (!newGroupName.trim()) {
      alert('Group name is required');
      return;
    }

    const validEmails = memberEmails.filter(email => email.trim() !== '');
    
    if (validEmails.length < 1) {
      alert('Add at least 1 member (you + 1 = 2 people total)');
      return;
    }

    setCreatingGroup(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/groups`,
        {
          name: newGroupName,
          member_emails: validEmails
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Reset form
      setNewGroupName('');
      setMemberEmails(['']);
      setShowCreateGroup(false);
      
      // Refresh groups
      await fetchGroups();
      await fetchSettlements();
      const memberCount = response.data?.group?.members?.length || 0;
      alert(`Group created successfully with ${memberCount} members!`);
    } catch (err) {
      alert('Failed to create group: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddMemberToGroup = async (e) => {
    e.preventDefault();

    if (!newMemberEmail.trim()) {
      alert('Enter a registered member email');
      return;
    }

    setAddingMember(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/groups/${selectedGroup.id}/members`,
        { email: newMemberEmail },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSelectedGroup(response.data.group);
      setGroups(prevGroups => (
        prevGroups.map(group => group.id === response.data.group.id ? response.data.group : group)
      ));
      await fetchSettlements();
      setNewMemberEmail('');
      alert('Member added successfully!');
    } catch (err) {
      alert('Failed to add member: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleProofInputChange = (settlement, value) => {
    setProofInputs(prevInputs => ({
      ...prevInputs,
      [getSettlementKey(settlement)]: value
    }));
  };

  const handleSubmitProof = async (settlement) => {
    const settlementKey = getSettlementKey(settlement);
    const proofText = proofInputs[settlementKey];

    if (!proofText?.trim()) {
      alert('Add payment proof details first');
      return;
    }

    setSettlementActionLoading(settlementKey);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/settlements/proofs`,
        {
          group_id: settlement.group.id,
          receiver_id: settlement.receiver.id,
          amount: settlement.amount,
          proof_text: proofText
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setProofInputs(prevInputs => ({
        ...prevInputs,
        [settlementKey]: ''
      }));
      await fetchSettlements();
      alert('Proof sent for approval!');
    } catch (err) {
      alert('Failed to send proof: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setSettlementActionLoading('');
    }
  };

  const handleReviewProof = async (proofId, status) => {
    setSettlementActionLoading(`${proofId}-${status}`);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${process.env.REACT_APP_API_URL}/settlements/proofs/${proofId}`,
        { status },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      await fetchSettlements();
      alert(`Proof ${status}`);
    } catch (err) {
      alert('Failed to review proof: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setSettlementActionLoading('');
    }
  };

  const handleDeleteGroup = async () => {
    const confirmed = window.confirm(
      `Delete "${selectedGroup.name}"? This is only allowed when all payments are settled.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingGroup(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/groups/${selectedGroup.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSelectedGroup(null);
      localStorage.removeItem('selectedGroupId');
      await fetchGroups();
      await fetchSettlements();
      alert('Group deleted successfully!');
    } catch (err) {
      alert('Failed to delete group: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setDeletingGroup(false);
    }
  };

  const renderSettlementStatus = (proof) => {
    if (!proof) {
      return <span className="settlement-status status-open">Proof not sent</span>;
    }

    return (
      <span className={`settlement-status status-${proof.status}`}>
        {proof.status}
      </span>
    );
  };

  // Group Detail View
  if (selectedGroup) {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div>
            <button className="btn-back" onClick={handleBackToGroups}>← Back</button>
            <h1>{selectedGroup.name}</h1>
            {selectedGroup.created_by === user.id && (
              <button
                type="button"
                className="btn-delete-group"
                onClick={handleDeleteGroup}
                disabled={deletingGroup}
              >
                {deletingGroup ? 'Deleting...' : 'Delete Group'}
              </button>
            )}
            {selectedGroup.members?.length > 0 && (
              <p className="group-detail-meta">
                {selectedGroup.members.length} member{selectedGroup.members.length === 1 ? '' : 's'}:{' '}
                {selectedGroup.members.map(formatMemberName).join(', ')}
              </p>
            )}
          </div>
          <div className="user-info">
            <span>Welcome, {user.name || user.email}</span>
            <button onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          <section className="group-detail-section">
            <div className="add-member-panel">
              <div>
                <h2>Members</h2>
                <p>{selectedGroup.members?.length || 0} people in this group</p>
              </div>
              <form className="add-member-form" onSubmit={handleAddMemberToGroup}>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="Registered member email"
                  disabled={addingMember}
                />
                <button type="submit" className="btn-add-member-inline" disabled={addingMember}>
                  {addingMember ? 'Adding...' : '+ Add Member'}
                </button>
              </form>
            </div>
            <GroupChat groupId={selectedGroup.id} user={user} />
            <Expenses
              groupId={selectedGroup.id}
              user={user}
              refreshKey={`${selectedGroup.members?.length || 0}-${selectedGroupId}`}
            />
          </section>
        </main>
      </div>
    );
  }

  // Groups List View
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Splitwise</h1>
        <div className="user-info">
          <span>Welcome, {user.name || user.email}</span>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="groups-section">
          <div className="section-header">
            <h2>Your Groups</h2>
            <button 
              className="btn-create-group"
              onClick={() => setShowCreateGroup(!showCreateGroup)}
            >
              {showCreateGroup ? 'Cancel' : '+ Create Group'}
            </button>
          </div>

          {showCreateGroup && (
            <form className="create-group-form" onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Apartment Roommates"
                  required
                />
              </div>

              <div className="form-group">
                <label>Registered Member Emails (min 1, so 2 total with you)</label>
                {memberEmails.map((email, index) => (
                  <input
                    key={index}
                    type="email"
                    value={email}
                    onChange={(e) => handleMemberEmailChange(index, e.target.value)}
                    placeholder={`Member ${index + 1} email`}
                    className="member-input"
                  />
                ))}
                <button
                  type="button"
                  className="btn-add-member"
                  onClick={handleAddMemberField}
                >
                  + Add More Members
                </button>
              </div>

              <button 
                type="submit" 
                className="btn btn-submit"
                disabled={creatingGroup}
              >
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          )}

          {loading ? (
            <p>Loading groups...</p>
          ) : error ? (
            <p className="error">{error}</p>
          ) : groups.length === 0 ? (
            <p className="empty-state">No groups yet. Create one to get started!</p>
          ) : (
            <div className="groups-list">
              {groups.map(group => (
                <div 
                  key={group.id} 
                  className="group-card"
                  onClick={() => handleGroupClick(group)}
                >
                  <h3>{group.name}</h3>
                  <p className="group-meta">Created: {new Date(group.created_at).toLocaleDateString()}</p>
                  {group.members?.length > 0 && (
                    <div className="group-members-preview">
                      {group.members.slice(0, 4).map(member => (
                        <span key={member.id}>{formatMemberName(member)}</span>
                      ))}
                      {group.members.length > 4 && (
                        <span>+{group.members.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="settlements-section">
          <h2>Pending Settlements</h2>
          {settlementsLoading ? (
            <p className="empty-state">Loading settlements...</p>
          ) : settlements.length === 0 ? (
            <p className="empty-state">No pending settlements right now.</p>
          ) : (
            <div className="dashboard-settlements-list">
              {settlements.map((settlement, index) => {
                const settlementKey = getSettlementKey(settlement);
                const isPayer = settlement.role === 'payer';
                const proof = settlement.proof;
                const actionDisabled = settlementActionLoading === settlementKey;

                return (
                  <div key={`${settlementKey}-${proof?.id || index}`} className="dashboard-settlement-card">
                    <div className="settlement-card-header">
                      <div>
                        <h3>{settlement.group.name}</h3>
                        <p>
                          {isPayer
                            ? `You pay ${formatMemberName(settlement.receiver)}`
                            : `${formatMemberName(settlement.payer)} pays you`}
                        </p>
                      </div>
                      <strong>{formatMoney(settlement.amount)}</strong>
                    </div>

                    <div className="settlement-proof-status">
                      {renderSettlementStatus(proof)}
                      {proof?.proof_text && (
                        <p>Proof: {proof.proof_text}</p>
                      )}
                    </div>

                    {isPayer && proof?.status !== 'pending' && (
                      <div className="settlement-proof-form">
                        <input
                          type="text"
                          value={proofInputs[settlementKey] || ''}
                          onChange={(e) => handleProofInputChange(settlement, e.target.value)}
                          placeholder={proof?.status === 'denied' ? 'Send updated proof' : 'Payment proof / transaction ID'}
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitProof(settlement)}
                          disabled={actionDisabled}
                        >
                          {actionDisabled ? 'Sending...' : 'Add Proof'}
                        </button>
                      </div>
                    )}

                    {!isPayer && proof?.status === 'pending' && (
                      <div className="settlement-review-actions">
                        <button
                          type="button"
                          className="btn-approve-proof"
                          onClick={() => handleReviewProof(proof.id, 'approved')}
                          disabled={settlementActionLoading !== ''}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-deny-proof"
                          onClick={() => handleReviewProof(proof.id, 'denied')}
                          disabled={settlementActionLoading !== ''}
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
