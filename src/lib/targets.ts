import { isTargetType } from './laserEngine';
import type { InventoryItem } from '../types/game';

// 아직 그리드에 놓이지 않은 인벤토리 표적 수.
//
// computeLaser 는 "주어진 그리드" 에 대한 순수 함수라 인벤토리를 모른다.
// 테스트(플레이) 상태에서는 isInventory 기물이 그리드에서 빠져 playerInventory 로
// 가므로, 표적을 인벤토리에 남겨둔 채로도 승리 판정이 서 버린다. 표시·판정 쪽에서
// 이 값을 더해 보정한다 (엔진은 건드리지 않는다).
export function countInventoryTargets(inv: Record<string, InventoryItem>): number {
  return Object.values(inv)
    .filter(item => isTargetType(item.type))
    .reduce((sum, item) => sum + item.count, 0);
}
