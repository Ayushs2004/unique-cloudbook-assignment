import { renderHook, act } from '@testing-library/react-native';
import { useLeadSocket } from '../src/hooks/useLeadSocket';
import { Lead } from '../src/types/lead';

const mockListeners: Record<string, Function[]> = {};
const mockIoListeners: Record<string, Function[]> = {};

const mockSocket: any = {
  on: jest.fn((event: string, cb: Function) => {
    mockListeners[event] = mockListeners[event] || [];
    mockListeners[event].push(cb);
    return mockSocket;
  }),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(() => {
    for (const key of Object.keys(mockListeners)) {
      delete mockListeners[key];
    }
    for (const key of Object.keys(mockIoListeners)) {
      delete mockIoListeners[key];
    }
  }),
  io: {
    on: jest.fn((event: string, cb: Function) => {
      mockIoListeners[event] = mockIoListeners[event] || [];
      mockIoListeners[event].push(cb);
      return mockSocket.io;
    }),
  },
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

describe('useLeadSocket Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.removeAllListeners();
  });

  it('initializes socket connection and updates status on connect/disconnect', () => {
    const { result, unmount } = renderHook(() =>
      useLeadSocket({ serverUrl: 'http://test-server:3000' })
    );

    // Initial state is connecting
    expect(result.current.connectionStatus).toBe('connecting');

    // Simulate socket 'connect' event
    act(() => {
      if (mockListeners['connect']) {
        mockListeners['connect'].forEach((cb) => cb());
      }
    });
    expect(result.current.connectionStatus).toBe('connected');

    // Simulate socket 'disconnect' event
    act(() => {
      if (mockListeners['disconnect']) {
        mockListeners['disconnect'].forEach((cb) => cb());
      }
    });
    expect(result.current.connectionStatus).toBe('disconnected');

    // Unmount should cleanup
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
  });

  it('triggers onNewLead callback when new-lead event is received', () => {
    const onNewLeadMock = jest.fn();

    renderHook(() =>
      useLeadSocket({
        serverUrl: 'http://test-server:3000',
        onNewLead: onNewLeadMock,
      })
    );

    const testLead: Lead = {
      id: 'lead_stream_1',
      formId: 'form_123',
      pageId: 'page_456',
      name: 'Realtime Lead',
      receivedAt: '2024-03-20T14:00:00.000Z',
    };

    act(() => {
      if (mockListeners['new-lead']) {
        mockListeners['new-lead'].forEach((cb) => cb(testLead));
      }
    });

    expect(onNewLeadMock).toHaveBeenCalledTimes(1);
    expect(onNewLeadMock).toHaveBeenCalledWith(testLead);
  });

  it('triggers onReconnect callback and updates status on reconnect', () => {
    const onReconnectMock = jest.fn();

    const { result } = renderHook(() =>
      useLeadSocket({
        serverUrl: 'http://test-server:3000',
        onReconnect: onReconnectMock,
      })
    );

    // Simulate reconnect_attempt
    act(() => {
      if (mockIoListeners['reconnect_attempt']) {
        mockIoListeners['reconnect_attempt'].forEach((cb) => cb());
      }
    });
    expect(result.current.connectionStatus).toBe('reconnecting');

    // Simulate reconnect
    act(() => {
      if (mockIoListeners['reconnect']) {
        mockIoListeners['reconnect'].forEach((cb) => cb());
      }
    });
    expect(result.current.connectionStatus).toBe('connected');
    expect(onReconnectMock).toHaveBeenCalledTimes(1);
  });
});
