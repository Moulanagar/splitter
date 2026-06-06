import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '../styles/GroupChat.css';

const GroupChat = ({ groupId, user }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/groups/${groupId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setMessages(response.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const intervalId = setInterval(fetchMessages, 5000);
    return () => clearInterval(intervalId);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatSender = (message) => (
    message.users?.name || message.users?.email || 'Group member'
  );

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim()) {
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/groups/${groupId}/messages`,
        { message: messageText },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMessages(prevMessages => [...prevMessages, response.data.chat_message]);
      setMessageText('');
    } catch (err) {
      alert('Failed to send message: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="group-chat-section">
      <div className="chat-header">
        <div>
          <h2>Group Chat</h2>
          <p>{messages.length} message{messages.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" className="btn-refresh-chat" onClick={fetchMessages}>
          Refresh
        </button>
      </div>

      <div className="chat-messages">
        {loading ? (
          <p className="chat-empty">Loading chat...</p>
        ) : messages.length === 0 ? (
          <p className="chat-empty">No messages yet.</p>
        ) : (
          messages.map(message => {
            const isOwnMessage = message.user_id === user.id;
            return (
              <div
                key={message.id}
                className={`chat-message ${isOwnMessage ? 'own-message' : ''}`}
              >
                <div className="chat-message-meta">
                  <strong>{isOwnMessage ? 'You' : formatSender(message)}</strong>
                  <span>{new Date(message.created_at).toLocaleString()}</span>
                </div>
                <p>{message.message}</p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Message this group"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !messageText.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </section>
  );
};

export default GroupChat;
