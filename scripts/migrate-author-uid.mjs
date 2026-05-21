/**
 * migrate-author-uid.mjs
 * 기존 익명 UID → 구글 UID 일괄 교체 스크립트 (1회 실행용)
 *
 * 사용법:
 *   1. npm install firebase-admin  (또는 npx 사용)
 *   2. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *      → serviceAccountKey.json 으로 저장 (이 파일과 같은 위치)
 *   3. 아래 UID_MAP 에 { 기존익명UID: '새구글UID' } 형식으로 매핑 입력
 *   4. node scripts/migrate-author-uid.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

// ─── 여기에 매핑 입력 ───────────────────────────────────────────
const UID_MAP = {
    // '기존_익명_uid_또는_anon_xxx': '새_구글_uid',
    // 예시:
    // 'oK8mNxxxxxxxxxxxxxxxx': 'ABC123googleuidxxxxxxxx',
};
// ───────────────────────────────────────────────────────────────

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrate() {
    const mapsSnap = await db.collection('maps').get();
    let updated = 0;
    let skipped = 0;

    for (const mapDoc of mapsSnap.docs) {
        const data = mapDoc.data();
        const oldUid = data.authorUid;
        const newUid = UID_MAP[oldUid];

        if (newUid) {
            await mapDoc.ref.update({ authorUid: newUid });
            console.log(`✅ 맵 [${data.title}] authorUid: ${oldUid} → ${newUid}`);
            updated++;
        } else {
            skipped++;
        }
    }

    console.log(`\n완료: ${updated}개 업데이트, ${skipped}개 스킵`);
}

migrate().catch(console.error);
