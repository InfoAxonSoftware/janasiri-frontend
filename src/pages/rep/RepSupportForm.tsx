import SupportTicketForm from '../../components/support/SupportTicketForm';
import { repSupportConfig } from '../support/roleSupportConfigs';

type Props = { onSuccess?: () => void; onCancel?: () => void };

export default function RepSupportForm({ onSuccess, onCancel }: Props) {
  return (
    <SupportTicketForm
      listQueryKey={repSupportConfig.listQueryKey}
      createTicket={repSupportConfig.createTicket}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
