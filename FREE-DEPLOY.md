# 무료 배포: Cloudflare Pages + Supabase Free

현재 사이트와 관리자 기능을 **유료 Node 서버 없이** 배포하는 방법입니다. 웹페이지는 Cloudflare Pages, 관리자 로그인·글·이미지는 Supabase Free를 사용합니다. 기본 제공 `pages.dev` 주소를 쓰므로 도메인 구매가 필요 없습니다.

이 저장소의 무료 배포 기능과 SQL 권한 정책은 로컬에서 검증했습니다. 실제 Cloudflare/Supabase 계정은 아직 연결되지 않았으며, 사이트 공개 완료를 의미하지 않습니다.

## 0. 준비

- 기존 GitHub 계정: `SEOLA1226/BBDESIGN` 저장소 접근에 사용합니다.
- [Supabase](https://supabase.com/dashboard) 계정: Free 조직과 프로젝트를 만듭니다.
- [Cloudflare](https://dash.cloudflare.com/) 계정: Pages 무료 호스팅을 사용합니다.
- 관리자 로그인용 이메일과 새 비밀번호: Supabase 화면에만 입력합니다. 채팅이나 GitHub에 비밀번호를 올리지 마세요.

유료 Render 설정은 제거했습니다. 이전 Render 안내는 사용하지 마세요. Free 플랜과 기본 제공 주소만 선택합니다.

## 1. Supabase 프로젝트 만들기

1. Supabase에 가입합니다. 기존 GitHub 계정으로 가입해도 됩니다.
2. 조직(Organization)을 만들 때 **Free**를 선택합니다.
3. **New project**를 눌러 프로젝트 이름을 `bbdesign`으로 정합니다.
4. 데이터베이스 비밀번호를 만들어 비밀번호 관리자에 보관합니다. 이 비밀번호는 관리자 사이트 로그인 비밀번호와 다릅니다.
5. 가까운 지역을 고르고 프로젝트가 준비될 때까지 기다립니다.

## 2. 데이터베이스와 이미지 저장소 준비

1. GitHub의 [supabase/setup.sql](https://github.com/SEOLA1226/BBDESIGN/blob/main/supabase/setup.sql)을 엽니다.
2. **Raw**를 눌러 SQL 전체를 복사합니다. 코드 일부만 복사하지 않습니다.
3. Supabase 프로젝트의 **SQL Editor → New query**를 엽니다.
4. 복사한 SQL 전체를 붙여넣고 **Run**을 누릅니다.
5. 오류 없이 끝나면 설정·작업·관리자 테이블과 `portfolio-images` 이미지 버킷이 만들어집니다.

SQL은 같은 프로젝트에서 다시 실행해도 기존 글을 초기화하지 않습니다. 방문자는 공개 내용을 읽을 수 있고, 글 변경과 업로드는 아래 단계에서 지정하는 관리자만 할 수 있습니다.

## 3. 본인만 관리자로 등록

1. Supabase의 **Authentication → Users → Add user → Create new user**에서 본인 이메일과 관리자 비밀번호를 입력합니다.
2. 비밀번호는 12자 이상으로 정합니다. **Auto Confirm User**가 보이면 체크합니다.
3. [supabase/owner.sql](https://github.com/SEOLA1226/BBDESIGN/blob/main/supabase/owner.sql)을 열고 전체를 복사합니다.
4. SQL Editor의 새 쿼리에 붙여넣고 `YOUR_EMAIL_HERE` 한 곳을 방금 만든 사용자 이메일로 바꿉니다. 양쪽 작은따옴표는 유지합니다.
5. **Run**을 누릅니다. 마지막 결과에 본인 이메일이 나와야 합니다. 결과가 0행이면 사용자 생성 여부나 이메일 철자를 확인합니다.
6. Authentication의 **Sign In / Providers** 또는 **Settings**에서 **Allow new users to sign up**을 끕니다. 관리자용으로 만든 사용자만 로그인하면 됩니다.

홈페이지에는 회원가입 기능이 없습니다. 다른 Supabase 사용자 계정이 있어도 `bb_admins`에 등록되지 않았다면 저장하거나 업로드할 수 없습니다. 프런트엔드에서 버튼만 숨기는 방식이 아니라 데이터베이스 권한으로 막습니다.

## 4. 공개 연결 정보 2개 복사

Supabase 프로젝트의 **Connect** 또는 **Project Settings**에서 다음 두 값을 찾습니다.

- **Project URL**: `https://프로젝트ID.supabase.co` 형태. Data API 설정에도 표시됩니다.
- **Publishable key**: `sb_publishable_`로 시작하는 키. API Keys 설정에 있습니다. 구형 프로젝트의 `anon` 키도 지원합니다.

**`sb_secret_` 키나 `service_role` 키, 데이터베이스 비밀번호는 사용하지 않습니다.** 이 사이트의 빌드 스크립트는 비밀 키를 거부하도록 구성했습니다. Publishable/anon 키는 공개 웹페이지가 사용하는 연결 정보이며, 수정 권한은 SQL 정책과 관리자 로그인으로 제한합니다.

## 5. Cloudflare Pages에 GitHub 연결

1. Cloudflare에 가입하고 대시보드로 들어갑니다.
2. **Workers & Pages → Create application → Pages → Connect to Git**을 선택합니다. Workers 서비스를 만드는 흐름과 구분합니다.
3. GitHub를 연결하고 `SEOLA1226/BBDESIGN` 저장소 접근을 허용합니다.
4. `BBDESIGN`을 선택하고 설정 화면으로 진행합니다.
5. 아래 값을 입력합니다.

| 항목 | 값 |
| --- | --- |
| Project name | `bbdesign` 또는 사용 가능한 다른 이름 |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 비워 두기 |

**`npm start`를 입력하지 않습니다.** 무료 구성은 정적 파일을 배포하며, 관리자 저장 요청은 Supabase로 전달됩니다.

## 6. 빌드 환경변수 입력 후 배포

같은 설정 화면의 **Environment variables**에 다음을 입력합니다. 설정 후 추가했다면 새 배포(Retry deployment)를 실행해야 반영됩니다.

| 변수 이름 | 값 |
| --- | --- |
| `NODE_VERSION` | `24` |
| `SUPABASE_URL` | 4단계의 Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | 4단계의 Publishable key 또는 legacy anon 키 |

변수 이름과 값에 추가 따옴표를 붙이지 않습니다. Production 환경에 적용합니다. 미리보기 브랜치도 사용할 경우 Preview 환경에도 같은 공개 연결 정보를 넣습니다.

**Save and Deploy**를 누릅니다. `Success`가 뜨면 Cloudflare가 실제 `https://…pages.dev` 주소를 발급합니다. 이 주소가 공유할 사이트 주소입니다. `bbdesign.pages.dev`는 사용 가능 여부가 확인되지 않은 예시이므로 대시보드에 실제 표시된 주소를 사용하세요.

Supabase Authentication의 URL Configuration에서 **Site URL**을 발급된 주소로 설정해 두세요. 현재 이메일·비밀번호 로그인은 리다이렉트를 사용하지 않지만, 이후 계정 이메일 기능을 사용할 때 필요합니다.

## 7. 관리자 로그인하고 내용 등록

1. 사이트 하단의 **관리자 ↗** 또는 사이트 주소 뒤 `/admin`으로 들어갑니다.
2. 3단계에서 만든 **이메일과 비밀번호**로 로그인합니다.
3. **섹션 구성**에서 폴더 이름·순서·표시 여부·미리보기 수를 정합니다.
4. **공지 · 소개**, **연락처**에서 문구를 수정하고 각각 저장합니다.
5. **포트폴리오 → 작업 추가**에서 이미지와 제목·설명·카테고리를 넣고 저장합니다.
6. 공개 사이트를 새로고침해 반영을 확인합니다.

관리자에서 내용을 저장할 때는 재배포가 필요 없습니다. 코드나 디자인을 GitHub에 업데이트하면 Cloudflare가 자동 재배포합니다. 배포할 때 데이터베이스나 업로드 파일은 삭제되지 않습니다.

## 무료 사용의 실제 제한

공식 문서를 확인한 시점의 Supabase Free 기본 제공량은 데이터베이스 500MB/프로젝트, 이미지 저장공간 1GB, Egress 5GB입니다. Cloudflare Pages Free는 월 500회 빌드와 파일 한 개당 25MiB 제한이 있습니다. 현재 제공 폰트는 이 파일 제한 이내입니다.

무료 플랜에도 사용량 제한이 있습니다. 사진은 업로드 전에 크기를 줄여서 보관하고, 사용량 화면을 확인하세요. 업로드 기능은 한 장 8MB, 한 번에 합계 16MB, 10장까지 받습니다. 장기간 비활성인 Supabase Free 프로젝트는 일시정지될 수 있으며, 이때 프로젝트 대시보드에서 재개해야 합니다. 항상 켜진 유료 서비스와 같은 보장은 없습니다.

일반 공개 주소를 위한 도메인을 별도로 구매할 필요는 없습니다. Pro 업그레이드, Supabase 유료 Custom Domain 등 유료 옵션을 선택하지 마세요. Free 한도를 넘으면 계속 무제한 무료로 작동하는 것은 아닙니다.

## 문제가 생기면

| 증상 | 확인할 내용 |
| --- | --- |
| 빌드에서 `Set SUPABASE_URL` | Cloudflare 환경변수 누락. 입력 후 재배포 |
| 키 관련 빌드 실패 | Publishable/anon 키인지 확인. Secret/service_role 키는 금지 |
| 메인은 뜨지만 콘텐츠 오류 | Project URL과 키가 같은 프로젝트 것인지, setup.sql 실행 여부, 프로젝트 일시정지 여부 |
| 관리자 화면에 이메일 칸이 없음 | 무료 정적 빌드 대신 기존 파일을 올린 상태. `npm run build` / `dist` 설정 확인 |
| `이 계정은 사이트 관리자로 등록되어 있지 않습니다` | owner.sql에 입력한 이메일과 Authentication 사용자 확인 |
| 로그인 자체가 실패 | Supabase Authentication의 사용자 이메일·비밀번호·이메일 확인 상태 확인 |
| 이미지 업로드 실패 | setup.sql의 버킷/권한 정책, Free 용량, 장당 8MB 제한 확인 |
| 예전 디자인이 보임 | Cloudflare 배포 상태를 확인하고 브라우저 새로고침 |

개발 환경의 `.data`에 저장된 SQLite 데이터는 Supabase로 자동 이전되지 않습니다. 현재 실제 등록 작업이 없는 상태라면 별도 이전 없이 관리자에서 새 작업을 등록하면 됩니다.

## 확인한 공식 자료

- [Supabase Free 제공량](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Cloudflare Pages Free 제한](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Git 연결](https://developers.cloudflare.com/pages/get-started/git-integration/)

실제 외부 서비스의 메뉴·정책이 바뀌면 해당 화면을 기준으로 확인하세요.
