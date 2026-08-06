import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** 취소 버튼을 숨겨 안내 전용(alert) 으로 쓴다 — 선택지가 없는 차단 안내용 */
  hideCancel?: boolean;
}

interface ConfirmModalProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title = '확인', message, confirmLabel = '확인', cancelLabel = '취소', danger, hideCancel,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          {!hideCancel && <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>}
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
