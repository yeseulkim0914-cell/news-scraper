# 아침 뉴스 스크랩

네이버 뉴스 푸드 · 경제 · 사회 기사를 매일 07:50(KST)에 모아 Outlook용 HTML로 만듭니다.
GitHub Actions가 실행하고 GitHub Pages에 올리므로 PC를 켜 둘 필요가 없습니다.

## 처음 한 번 설정

1. 새 GitHub 저장소를 만들고 이 폴더 전체를 올립니다. `.github/workflows/news.yml`도 함께 올려야 합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
3. **Actions** 탭 → "아침 뉴스 스크랩" → **Run workflow** 로 한 번 돌려 봅니다.
4. 끝나면 `https://<아이디>.github.io/<저장소>/` 에서 오늘자 HTML이 열립니다.

## 결과 주소

| 주소 | 내용 |
| --- | --- |
| `/` | 오늘자 Outlook용 HTML |
| `/news.json` | 같은 내용의 JSON (아티팩트 뷰어에 끌어다 놓기용) |
| `/news-YYYY-MM-DD.html` | 날짜가 붙은 같은 파일 |

Outlook에 넣을 때는 페이지를 열어 전체 선택(Ctrl+A) 후 복사해 새 메일 본문에 붙여넣으면 됩니다.

## 알아 둘 것

- GitHub 예약 실행은 붐비는 시간에 5~30분 늦게 시작될 수 있습니다. 07:50 전에 받아야 하면 `news.yml`의 cron을 `30 22 * * *` 처럼 앞당기세요.
- 저장소에 60일 동안 커밋이 없으면 GitHub가 예약 실행을 멈춥니다. 메일이 오면 버튼 한 번으로 다시 켤 수 있습니다.
- GitHub Pages는 저장소가 공개일 때 무료입니다. 비공개 저장소의 Pages는 유료 플랜이 필요합니다.
- 0건이 나오면 네이버 마크업이 바뀐 것입니다. `news-scrap.mjs`의 `parseList` 셀렉터를 맞춰 주세요.
