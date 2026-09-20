import React from 'react';
import { render, act } from '@testing-library/react-native';
import { LeadsScreen } from '../src/screens/LeadsScreen';
import * as useLeadsQueryModule from '../src/hooks/useLeadsQuery';
import * as useLeadSocketModule from '../src/hooks/useLeadSocket';
import { Lead } from '../src/types/lead';

describe('LeadsScreen Component', () => {
  let mockSetLeads: jest.Mock;
  let mockRefetch: jest.Mock;
  let capturedSocketOptions: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetLeads = jest.fn();
    mockRefetch = jest.fn();
    capturedSocketOptions = {};

    jest.spyOn(useLeadSocketModule, 'useLeadSocket').mockImplementation((options) => {
      capturedSocketOptions = options;
      return {
        connectionStatus: 'connected',
        socket: null,
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the empty state when there are no leads', () => {
    jest.spyOn(useLeadsQueryModule, 'useLeadsQuery').mockReturnValue({
      leads: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    });

    const { getByTestId, getByText } = render(<LeadsScreen />);

    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByText('No Leads Yet')).toBeTruthy();
  });

  it('renders a populated list of leads with details', () => {
    const mockLeads: Lead[] = [
      {
        id: 'lead_1',
        formId: 'form_100',
        pageId: 'page_200',
        name: 'Sarah Connor',
        email: 'sarah@skynet.com',
        phone: '+1555987654',
        receivedAt: '2024-03-20T10:00:00.000Z',
      },
    ];

    jest.spyOn(useLeadsQueryModule, 'useLeadsQuery').mockReturnValue({
      leads: mockLeads,
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    });

    const { getByTestId, getByText } = render(<LeadsScreen />);

    expect(getByTestId('lead-card-lead_1')).toBeTruthy();
    expect(getByText('Sarah Connor')).toBeTruthy();
    expect(getByText('sarah@skynet.com')).toBeTruthy();
    expect(getByText('+1555987654')).toBeTruthy();
    expect(getByText('ID: lead_1')).toBeTruthy();
    expect(getByText('Form: form_100')).toBeTruthy();
  });

  it('reflects connection status in the badge', () => {
    jest.spyOn(useLeadsQueryModule, 'useLeadsQuery').mockReturnValue({
      leads: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    });

    jest.spyOn(useLeadSocketModule, 'useLeadSocket').mockReturnValue({
      connectionStatus: 'connected',
      socket: null,
    });

    const { getByTestId, getByText, rerender } = render(<LeadsScreen />);
    expect(getByTestId('status-badge')).toBeTruthy();
    expect(getByText('Live Connected')).toBeTruthy();

    // Now update connection status to disconnected
    jest.spyOn(useLeadSocketModule, 'useLeadSocket').mockReturnValue({
      connectionStatus: 'disconnected',
      socket: null,
    });

    rerender(<LeadsScreen />);
    expect(getByText('Disconnected')).toBeTruthy();
  });

  it('prepends a newly received lead to the list via onNewLead event', () => {
    let currentLeads: Lead[] = [
      {
        id: 'lead_existing',
        formId: 'form_1',
        pageId: 'page_1',
        name: 'Existing Lead',
        receivedAt: '2024-03-20T09:00:00.000Z',
      },
    ];

    mockSetLeads.mockImplementation((updater) => {
      currentLeads = typeof updater === 'function' ? updater(currentLeads) : updater;
    });

    jest.spyOn(useLeadsQueryModule, 'useLeadsQuery').mockImplementation(() => ({
      leads: currentLeads,
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    }));

    render(<LeadsScreen />);

    // Simulate incoming new-lead via socket callback
    const incomingLead: Lead = {
      id: 'lead_new_incoming',
      formId: 'form_2',
      pageId: 'page_2',
      name: 'Fresh Lead',
      receivedAt: '2024-03-20T10:00:00.000Z',
    };

    act(() => {
      capturedSocketOptions.onNewLead(incomingLead);
    });

    expect(mockSetLeads).toHaveBeenCalled();
    expect(currentLeads.length).toBe(2);
    expect(currentLeads[0].id).toBe('lead_new_incoming');
    expect(currentLeads[1].id).toBe('lead_existing');
  });
});
