/**
 * Lead data model contract matching the server's emitted shape.
 */
export interface Lead {
  id: string; // leadgen_id from Meta — dedup key
  formId: string;
  pageId: string;
  name?: string;
  email?: string;
  phone?: string;
  rawFieldData?: Record<string, string>;
  receivedAt: string; // ISO timestamp
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
