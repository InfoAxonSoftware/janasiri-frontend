import SupportTicketForm from '../../components/support/SupportTicketForm';
import { coordinatorSupportConfig } from '../support/roleSupportConfigs';

type Props = { onSuccess?: () => void; onCancel?: () => void };

export default function CoordinatorSupportForm({ onSuccess, onCancel }: Props) {
  return (
    <SupportTicketForm
      listQueryKey={coordinatorSupportConfig.listQueryKey}
      createTicket={coordinatorSupportConfig.createTicket}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
