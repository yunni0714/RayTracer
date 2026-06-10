import { cx } from './cx';
import { Button, type ButtonVariant } from './Button';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  'aria-label': string; // 아이콘 전용 버튼은 라벨 필수
}

// 정사각 아이콘/이모지 버튼. Button 위에 패딩만 조정.
export function IconButton({ variant = 'ghost', className, ...rest }: IconButtonProps) {
  return <Button variant={variant} className={cx('!px-2 !py-2 leading-none', className)} {...rest} />;
}
