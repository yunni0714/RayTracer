/**
 * backfill-grid-size.mjs
 * gridSize 필드가 없는 옛날 맵(2026-06-10 이전 등록)에 gridSize: 5 를 채워 넣는다. 1회 실행용.
 *
 * 왜 필요한가:
 *   런타임 코드는 `mapObj.gridSize ?? 5` 로 없는 값을 5 로 메운다(lib/mapGrid.ts).
 *   하지만 Firestore 색인에는 **그 필드를 가진 문서만** 등재되고, "필드가 없음" 을
 *   조건으로 거는 연산자도 없다. 그래서 where('gridSize','==',5) 를 쓰는 순간
 *   옛날 맵이 통째로 사라진다 — 라이브러리에서 6월 이전 맵이 안 보이던 것과 같은 함정.
 *   이 값을 실제로 채워 넣어야 그리드 크기 필터를 서버로 넘길 수 있다.
 *
 * 사용법:
 *   1. npm install firebase-admin
 *   2. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *      → scripts/serviceAccountKey.json 으로 저장
 *   3. node scripts/backfill-grid-size.mjs --dry-run   ← 먼저 이걸로 검사만
 *   4. 검사를 통과하면  node scripts/backfill-grid-size.mjs
 *
 * 안전장치 (assert-then-write):
 *   "6/10 이전 맵은 전부 5칸" 이라는 가정을 코드가 검증한다. gridSize 가 없는 맵 중
 *   좌표가 5 이상인 기물을 쓴 게 하나라도 있으면 **아무것도 쓰지 않고** 목록만 출력하고
 *   종료한다. mapData 에서 max(x,y)+1 을 유도하지 않는 이유: 5×5 맵이 마지막 열을
 *   비워 두면 4 가 나와서 오히려 데이터를 망가뜨린다.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

const LEGACY_GRID_SIZE = 5;
const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/** 좌표가 5×5 를 벗어나는 기물이 있으면 그 좌표들을 돌려준다 (가정 위반 증거). */
function outOfRangeItems(mapData) {
  if (!Array.isArray(mapData)) return [];
  return mapData.filter(
    it => Number(it?.x) >= LEGACY_GRID_SIZE || Number(it?.y) >= LEGACY_GRID_SIZE,
  );
}

async function main() {
  const snap = await db.collection('maps').get();
  console.log(`맵 ${snap.size}개 조회`);

  const targets = [];
  const violations = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.gridSize !== undefined && data.gridSize !== null) continue; // 이미 있음

    const bad = outOfRangeItems(data.mapData);
    if (bad.length > 0) {
      violations.push({ id: docSnap.id, title: data.title ?? '(제목 없음)', bad });
    } else {
      targets.push({ ref: docSnap.ref, id: docSnap.id, title: data.title ?? '(제목 없음)' });
    }
  }

  console.log(`gridSize 없는 맵: ${targets.length + violations.length}개`);

  if (violations.length > 0) {
    console.error(`\n❌ 검사 실패 — 5×5 를 벗어난 기물을 쓰는 맵이 ${violations.length}개 있습니다.`);
    console.error('   "6/10 이전 맵은 전부 5칸" 가정이 깨졌습니다. 아무것도 쓰지 않고 종료합니다.');
    console.error('   아래 맵들의 실제 그리드 크기를 확인한 뒤 개별로 처리하세요.\n');
    for (const v of violations) {
      const coords = v.bad.map(it => `(${it.x},${it.y})`).join(' ');
      console.error(`   - ${v.id}  [${v.title}]  범위 밖 좌표: ${coords}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`✅ 검사 통과 — 대상 ${targets.length}개 전부 5×5 범위 안입니다.`);

  if (targets.length === 0) {
    console.log('채워 넣을 맵이 없습니다. (이미 백필됨)');
    return;
  }

  if (DRY_RUN) {
    console.log('\n--dry-run 이므로 여기서 멈춥니다. 실제로 쓰려면 플래그 없이 다시 실행하세요.');
    for (const t of targets) console.log(`   - ${t.id}  [${t.title}]`);
    return;
  }

  // 500 건이 배치 상한이라 나눠 커밋한다
  const BATCH_MAX = 500;
  let written = 0;
  for (let i = 0; i < targets.length; i += BATCH_MAX) {
    const chunk = targets.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const t of chunk) batch.update(t.ref, { gridSize: LEGACY_GRID_SIZE });
    await batch.commit();
    written += chunk.length;
    console.log(`   ...${written}/${targets.length}`);
  }

  console.log(`\n완료: ${written}개에 gridSize: ${LEGACY_GRID_SIZE} 기록`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
