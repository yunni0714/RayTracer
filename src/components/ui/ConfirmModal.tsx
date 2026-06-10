import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmModalProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title = '확인', message, confirmLabel = '확인', cancelLabel = '취소', danger, onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted whitespace-pre-line">{message}</p>
    </Modal>
  );
}
