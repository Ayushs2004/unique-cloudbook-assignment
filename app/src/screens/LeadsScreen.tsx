import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useLeadsQuery } from '../hooks/useLeadsQuery';
import { useLeadSocket } from '../hooks/useLeadSocket';
import { ConnectionStatus, Lead } from '../types/lead';
import { simulateLead, submitMetaLeadAd } from '../services/api';

export interface LeadsScreenProps {
  serverUrl?: string;
}

export const LeadsScreen: React.FC<LeadsScreenProps> = ({ serverUrl }) => {
  const { leads, loading, error, refetch, setLeads } = useLeadsQuery(serverUrl);
  const [refreshing, setRefreshing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // Form input fields for real test scenarios
  const [inputName, setInputName] = useState('Ayush Soni');
  const [inputEmail, setInputEmail] = useState('ayush@example.com');
  const [inputPhone, setInputPhone] = useState('+91 9876543210');
  const [inputForm, setInputForm] = useState('Product Demo Lead Form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const handleSimulateLead = useCallback(async () => {
    try {
      setIsSimulating(true);
      await simulateLead(undefined, serverUrl);
    } catch (err) {
      console.error('Failed to simulate lead:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [serverUrl]);

  const handleSubmitLeadAd = useCallback(async () => {
    if (!inputName.trim() || !inputEmail.trim()) {
      setSubmitMessage('⚠️ Please enter both your name and email.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitMessage(null);
      const res = await submitMetaLeadAd(
        {
          name: inputName.trim(),
          email: inputEmail.trim(),
          phone: inputPhone.trim() || undefined,
          formId: inputForm.trim() || undefined,
        },
        serverUrl
      );
      setSubmitMessage(
        `✅ Webhook Delivered (Ack ${res.webhookAckStatus})! HMAC Verified. Streamed live via Socket.IO.`
      );
    } catch (err: any) {
      setSubmitMessage(`❌ Error triggering webhook: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [inputName, inputEmail, inputPhone, inputForm, serverUrl]);

  // Latest seen receivedAt timestamp for incremental reconnect resync
  const latestTimestamp = useMemo(() => {
    if (leads.length === 0) return undefined;
    return leads[0].receivedAt;
  }, [leads]);

  // Handle live new lead event pushed over Socket.IO
  const handleNewLead = useCallback(
    (newLead: Lead) => {
      setLeads((prevLeads) => {
        // Idempotency in UI: prevent duplicate entries
        if (prevLeads.some((l) => l.id === newLead.id)) {
          return prevLeads;
        }
        // Prepend new lead at the top (newest first)
        return [newLead, ...prevLeads];
      });
    },
    [setLeads]
  );

  // Resync missed leads on socket reconnection
  const handleReconnect = useCallback(() => {
    refetch(latestTimestamp);
  }, [refetch, latestTimestamp]);

  const { connectionStatus } = useLeadSocket({
    serverUrl,
    onNewLead: handleNewLead,
    onReconnect: handleReconnect,
  });

  const onManualRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderStatusBadge = (status: ConnectionStatus) => {
    let text = 'Connecting...';
    let badgeStyle = styles.badgeConnecting;
    let dotStyle = styles.dotConnecting;

    switch (status) {
      case 'connected':
        text = 'Live Connected';
        badgeStyle = styles.badgeConnected;
        dotStyle = styles.dotConnected;
        break;
      case 'reconnecting':
        text = 'Reconnecting...';
        badgeStyle = styles.badgeReconnecting;
        dotStyle = styles.dotReconnecting;
        break;
      case 'disconnected':
        text = 'Disconnected';
        badgeStyle = styles.badgeDisconnected;
        dotStyle = styles.dotDisconnected;
        break;
    }

    return (
      <View testID="status-badge" style={[styles.badgeContainer, badgeStyle]}>
        <View style={[styles.statusDot, dotStyle]} />
        <Text style={styles.badgeText}>{text}</Text>
      </View>
    );
  };

  const renderLeadItem = ({ item, index }: { item: Lead; index: number }) => {
    const formattedTime = item.receivedAt
      ? new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';

    return (
      <View testID={`lead-card-${item.id}`} style={styles.leadCard}>
        <View style={styles.leadHeader}>
          <Text style={styles.leadName}>{item.name || 'Anonymous Lead'}</Text>
          <Text style={styles.leadTime}>{formattedTime}</Text>
        </View>

        {item.email ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email:</Text>
            <Text style={styles.fieldValue}>{item.email}</Text>
          </View>
        ) : null}

        {item.phone ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Phone:</Text>
            <Text style={styles.fieldValue}>{item.phone}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaBadge}>ID: {item.id}</Text>
          {item.formId ? <Text style={styles.metaBadge}>Form: {item.formId}</Text> : null}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading && leads.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" testID="loading-indicator" />
          <Text style={styles.emptySubtitle}>Loading incoming leads...</Text>
        </View>
      );
    }

    return (
      <View testID="empty-state" style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No Leads Yet</Text>
        <Text style={styles.emptySubtitle}>
          Incoming leads from Meta Lead Ads will stream in here live via Webhooks & Socket.IO without manual refresh.
        </Text>
        <TouchableOpacity
          style={styles.emptySimulateBtn}
          onPress={handleSimulateLead}
          disabled={isSimulating}
        >
          <Text style={styles.simulateBtnText}>{isSimulating ? 'Sending...' : '⚡ Simulate Test Lead'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Meta Lead Ads</Text>
          <Text style={styles.subtitle}>Real-time Lead Stream</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="simulate-lead-btn"
            style={[styles.simulateBtn, isSimulating && styles.simulateBtnDisabled]}
            onPress={handleSimulateLead}
            disabled={isSimulating}
          >
            <Text style={styles.simulateBtnText}>{isSimulating ? 'Sending...' : '⚡ Simulate Lead'}</Text>
          </TouchableOpacity>
          {renderStatusBadge(connectionStatus)}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner} testID="error-banner">
          <Text style={styles.errorText}>Error fetching leads: {error.message}</Text>
        </View>
      ) : null}

      {showForm ? (
        <View style={styles.formCard}>
          <View style={styles.formCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formCardTitle}>📝 Meta Lead Ad Live Tester</Text>
              <Text style={styles.formCardSubtitle}>
                Submits your details through the full HMAC-SHA256 signed Webhook → Graph API → Socket.IO pipeline.
              </Text>
            </View>
          </View>

          <View style={styles.formGrid}>
            <View style={styles.inputFieldWrapper}>
              <Text style={styles.fieldHeading}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Name"
                placeholderTextColor="#64748b"
                value={inputName}
                onChangeText={setInputName}
              />
            </View>
            <View style={styles.inputFieldWrapper}>
              <Text style={styles.fieldHeading}>Email Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. mail@example.com"
                placeholderTextColor="#64748b"
                value={inputEmail}
                onChangeText={setInputEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputFieldWrapper}>
              <Text style={styles.fieldHeading}>Phone Number</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. +91 1234567890"
                placeholderTextColor="#64748b"
                value={inputPhone}
                onChangeText={setInputPhone}
              />
            </View>
            <View style={styles.inputFieldWrapper}>
              <Text style={styles.fieldHeading}>Campaign / Form Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Product Demo Form"
                placeholderTextColor="#64748b"
                value={inputForm}
                onChangeText={setInputForm}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitLeadAdButton, isSubmitting && styles.submitAdBtnDisabled]}
            onPress={handleSubmitLeadAd}
            disabled={isSubmitting}
          >
            <Text style={styles.submitLeadAdButtonText}>
              {isSubmitting ? 'Signing & Dispatching Webhook...' : '🚀 Submit Lead Ad (Trigger POST /webhook)'}
            </Text>
          </TouchableOpacity>

          {submitMessage ? (
            <View
              style={[
                styles.submissionMessageBanner,
                submitMessage.includes('❌') ? styles.submissionError : styles.submissionSuccess,
              ]}
            >
              <Text style={styles.submissionMessageText}>{submitMessage}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.leadStreamHeader}>
        <Text style={styles.leadStreamTitle}>
          📥 Live Lead Stream ({leads.length})
        </Text>
        <TouchableOpacity
          style={styles.toggleFormButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.toggleFormButtonText}>{showForm ? 'Hide Form' : '📝 Open Lead Form'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        renderItem={renderLeadItem}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={leads.length === 0 ? styles.emptyListContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onManualRefresh} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeConnected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e',
    borderWidth: 1,
  },
  dotConnected: {
    backgroundColor: '#22c55e',
  },
  badgeConnecting: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: '#eab308',
    borderWidth: 1,
  },
  dotConnecting: {
    backgroundColor: '#eab308',
  },
  badgeReconnecting: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: '#f97316',
    borderWidth: 1,
  },
  dotReconnecting: {
    backgroundColor: '#f97316',
  },
  badgeDisconnected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  dotDisconnected: {
    backgroundColor: '#ef4444',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    padding: 16,
  },
  leadCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  leadTime: {
    fontSize: 12,
    color: '#64748b',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  fieldLabel: {
    width: 55,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  metaBadge: {
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    overflow: 'hidden',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  simulateBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  simulateBtnDisabled: {
    opacity: 0.6,
  },
  simulateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptySimulateBtn: {
    backgroundColor: '#2563eb',
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  formCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  formCardHeader: {
    marginBottom: 12,
  },
  formCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#60a5fa',
  },
  formCardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3,
    lineHeight: 17,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  inputFieldWrapper: {
    flex: 1,
    minWidth: 150,
  },
  fieldHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 13,
  },
  submitLeadAdButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  submitAdBtnDisabled: {
    opacity: 0.6,
  },
  submitLeadAdButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  submissionMessageBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  submissionSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e',
  },
  submissionError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  submissionMessageText: {
    fontSize: 12,
    color: '#f8fafc',
    textAlign: 'center',
    fontWeight: '500',
  },
  leadStreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  leadStreamTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  toggleFormButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleFormButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93c5fd',
  },
});
