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
} from 'react-native';
import { useLeadsQuery } from '../hooks/useLeadsQuery';
import { useLeadSocket } from '../hooks/useLeadSocket';
import { ConnectionStatus, Lead } from '../types/lead';

export interface LeadsScreenProps {
  serverUrl?: string;
}

export const LeadsScreen: React.FC<LeadsScreenProps> = ({ serverUrl }) => {
  const { leads, loading, error, refetch, setLeads } = useLeadsQuery(serverUrl);
  const [refreshing, setRefreshing] = useState(false);

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
        {renderStatusBadge(connectionStatus)}
      </View>

      {error ? (
        <View style={styles.errorBanner} testID="error-banner">
          <Text style={styles.errorText}>Error fetching leads: {error.message}</Text>
        </View>
      ) : null}

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
});
