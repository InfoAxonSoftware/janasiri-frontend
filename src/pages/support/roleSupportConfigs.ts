import { supportApi } from '../../services/api/supportApi';

export const repSupportConfig = {
  senderRole: 'SalesRep' as const,
  listQueryKey: 'rep-complaints',
  messageQueryPrefix: 'rep-complaint-messages',
  lastReadStorageKey: 'rep_support_last_read',
  desktopCreatePath: '/rep/support/new',
  getComplaints: () => supportApi.repGetComplaints().then((r) => r.data.data),
  getMessages: (id: string) => supportApi.repGetMessages(id).then((r) => r.data.data || []),
  sendMessage: (id: string, payload: { message: string }) => supportApi.repSendMessage(id, payload),
  createTicket: (payload: {
    subject: string;
    ticketType?: 'Support' | 'Complaint';
    description: string;
    priority?: string;
    orderId?: string;
  }) => supportApi.repCreateComplaint(payload),
};

export const customerSupportConfig = {
  senderRole: 'Customer' as const,
  listQueryKey: 'customer-complaints',
  messageQueryPrefix: 'customer-complaint-messages',
  lastReadStorageKey: 'customer_support_last_read',
  desktopCreatePath: '/shop/support/new',
  getComplaints: () => supportApi.customerGetComplaints().then((r) => r.data.data),
  getMessages: (id: string) => supportApi.customerGetMessages(id).then((r) => r.data.data || []),
  sendMessage: (id: string, payload: { message: string }) => supportApi.customerSendMessage(id, payload),
  createTicket: (payload: {
    subject: string;
    ticketType?: 'Support' | 'Complaint';
    description: string;
    priority?: string;
    orderId?: string;
  }) => supportApi.customerCreateComplaint(payload),
};

export const coordinatorSupportConfig = {
  senderRole: 'SalesCoordinator' as const,
  listQueryKey: 'coordinator-complaints',
  messageQueryPrefix: 'coordinator-complaint-messages',
  lastReadStorageKey: 'coordinator_support_last_read',
  desktopCreatePath: '/coordinator/support/new',
  getComplaints: () => supportApi.coordinatorGetComplaints().then((r) => r.data.data),
  getMessages: (id: string) => supportApi.coordinatorGetMessages(id).then((r) => r.data.data || []),
  sendMessage: (id: string, payload: { message: string }) => supportApi.coordinatorSendMessage(id, payload),
  createTicket: (payload: {
    subject: string;
    ticketType?: 'Support' | 'Complaint';
    description: string;
    priority?: string;
    orderId?: string;
  }) => supportApi.coordinatorCreateComplaint(payload),
};
