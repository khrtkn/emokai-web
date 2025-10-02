# SOFU AR Character Creator – Product Specification

## 1. Document Control
- **Document ID**: SOFU-PRD-001
- **Version**: 0.1 (draft)
- **Last Updated**: 2025-02-14
- **Author**: Codex assistant

## 2. Purpose & Scope
This document describes the functional and non-functional requirements for the SOFU AR Character Creator web application. The product enables guest users to create AR-ready characters placed within custom stages, generate associated narratives, and share or browse created works. The scope covers the end-to-end user journey from initial access through gallery browsing, including data retention policies and integrations with third-party services.

## 3. Assumptions & Constraints
- Deployment target: responsive mobile-first web application (no PWA packaging).
- Users access without authentication; the system issues guest session IDs instead of accounts.
- External APIs (OpenAI, Google NanobananaAPI, TripoAPI, Supabase, GA4) are available and reachable under the network policy.
- Network access may be restricted; system must queue or report failures accordingly.
- All generated media is considered public and must display CC BY-SA 4.0 attribution.

## 4. User Roles
- **Guest User**: Only role; can create up to three works per calendar day per IP + session ID combination, browse the public gallery, share works, and view AR.
- **System**: Composite role representing backend workflows, moderation, generation services, storage, and analytics.

## 5. Supported Platforms
| Platform | OS Version | Browser | Notes |
|----------|------------|---------|-------|
| iOS | 14+ | Safari | AR via WebAR if camera permission granted. |
| Android | 8+ | Chrome | AR via WebAR if camera permission granted. |
| Other | - | - | Not officially supported; offer 3D viewer fallback when AR unsupported. |

## 6. High-Level Architecture Overview
- **Client (Mobile Web UI)**: Detects device type, enforces portrait orientation, renders localized UI (Japanese/English), orchestrates user interactions, and stores temporary state (sessionStorage/localStorage).
- **Backend Services**: Vercel Functions or equivalent for coordinating moderation, generation requests, data persistence, and analytics event forwarding. Handles long-running jobs via background workers to stay within 10s function timeout.
- **External Integrations**:
  - *OpenAI Moderation API*: Filters inappropriate text.
  - *OpenAI API*: Generates 500-character narrative.
  - *Google Gemini 2.5 Flash Image API (Nanobanana)*: Generates isometric stage images and composite character-in-stage images.
  - *TripoAPI*: Produces 3D character model (FBX, ≤5000 polygons, 512×512 texture).
  - *Supabase*: Real-time backup and database/storage services.
  - *Google Analytics 4*: Event tracking for usage metrics.

## 7. Detailed User Journey & Functional Requirements

### Step 0 – Initial Setup
1. System identifies device type (iOS/Android) on first load.
2. Render mobile-optimized landing UI.
3. Present language selection (Japanese or English); persist choice for session.
4. Display Terms of Use and license notice.
5. Show capability usage notice: camera (AR), photo library (image selection).
6. User must accept terms before proceeding; on acceptance, generate unique guest session ID and store in sessionStorage.

### Step A – Stage Generation
1. User enters descriptive text about the stage location.
2. System moderates text via OpenAI Moderation API and NG word list; reject with localized error when inappropriate.
3. User taps “Upload Photo”.
   - Show menu: “Take Photo” or “Choose from Library”.
   - If “Take Photo”: prompt OS camera permission; on grant launch camera, on denial show localized error.
   - If “Choose from Library”: request OS-specific access (iOS: selected/all photos, Android: storage); on denial show localized error.
4. User supplies a stage reference photo.
5. System post-processes image:
   - Strip EXIF and identifiable information.
   - Resize to 512×512.
   - Convert to WebP.
   - Delete original image post-processing.
6. Call Google Gemini 2.5 Flash Image API (Nanobanana) to generate four photorealistic isometric interpretations of the stage.
   - On failure, retry up to three times; if all fail, show error and return to previous step.
7. Display four generated images in vertical scroll; no previews before selection.
8. User selects one image (tap highlights frame) and can change selection until confirmed.
9. On confirm, store selected image ID in sessionStorage; mark unselected images with delete flag for later cleanup.

### Step B – Character Generation
1. User enters descriptive text for the character.
2. System moderates text as in Step A; reject inappropriate input.
3. Request the Gemini 2.5 Flash Image API (Nanobanana) to generate four candidate character appearance images.
4. Present images in vertical scroll with tap-to-select highlighting; no pre-selection previews.
5. User confirms one image; selection remains changeable until confirmation.
6. Save chosen character image ID in sessionStorage.
7. Display progress bar and launch Steps C1, C2, C3 in parallel.
8. Lock the session to a single in-progress generation; additional attempts (including other tabs) must show “すでに生成処理中です / A generation is already in progress” and block new jobs.

### Step C1 – 3D Model Generation
- Input: selected character appearance image.
- Call TripoAPI to produce FBX model (≤5000 polygons, 512×512 textures).
- Wait for up to 30 seconds before showing a “please wait” state; continue waiting until 120 seconds before timing out with localized error.
- On success, store model metadata and download link in persistent storage.
- No explicit file size cap is enforced beyond API constraints; log resulting size for monitoring.

### Step C2 – Composite Image Generation
- Inputs: selected stage isometric image + character appearance image.
- Request the Gemini 2.5 Flash Image API (Nanobanana) to synthesize a photorealistic composite showing the character in the stage.
- Wait for up to 30 seconds silently; display “generating…” indicator after that. Timeout at 60 seconds with error.
- On success, persist composite image reference and metadata.

### Step C3 – Narrative Generation
- Input: character description text.
- Call OpenAI API to generate ~500 characters (Japanese or English per user preference) in narrative style, covering character name, location description, personality, and origin reason.
- Detect NG words in output; if detected, sanitize offending segments before display.
- Timeout if API exceeds 10 seconds; surface localized error and allow retry.

### Step D – Result Presentation
1. When Step C3 completes, display the narrative in a dedicated story UI.
2. When Step C2 completes and the user taps “Next”, show the composite image in the character display UI.
3. When Step C1 completes and the user taps “Next”, reveal AR display button on AR camera UI.
4. Always show CC BY-SA 4.0 license notice on result screens.
5. If the user closes or reloads the browser before all generations complete, cancel outstanding jobs and mark the session so the next load shows a cancellation notice.

### Step E – AR Experience
1. User taps “AR View” button.
2. Check browser (Safari/Chrome) and OS support (iOS14+/Android8+); if unsupported, show fallback message and switch to 3D viewer.
3. Request camera permission; on denial, display localized error and offer 3D viewer option. On approval, launch WebAR session.
4. During plane detection, show “Searching for a flat surface…” message.
5. Once plane detected, prompt “Tap to place”. Default model scale is life-size; user can adjust via pinch gestures.
6. User can place and inspect model in physical space.
7. Camera capture flow:
   - On capture, temporarily store photo in memory.
   - Ask to save; if user declines, discard image.
   - If accepted: iOS Safari triggers “Save Image” action sheet; Android Chrome prompts download permission.
   - Save as JPEG (quality 70%) without watermark. If save succeeds, show “Saved” toast; on failure, display localized error.
8. If AR unsupported or permission denied, present interactive 3D viewer (rotation via mouse/touch, pinch zoom where available).

### Step F – Save & Share
1. User taps “Save”. System checks creation limit (3/day) using IP + session ID + localStorage timestamp.
   - If limit reached, calculate remaining time until next reset (midnight local time) and show message: “本日の作成上限（3回）に達しました。約○時間後にリセットされます / You have reached today’s limit of 3 creations. Resets in ~X hours.”
2. On pass, persist the following to database with Supabase backup:
   - Stage description text.
   - Processed stage photo (WebP).
   - Selected stage isometric image ID and asset.
   - Selected character appearance image ID and asset.
   - Composite image.
   - 3D model (FBX) and texture assets.
   - Generated narrative text.
   - Metadata: timestamps, session ID, IP hash (if required), language selection.
3. Generate a unique shareable URL valid for 30 days; store expiry metadata.
4. User may tap “Share” to open share method menu:
   - URL copy to clipboard.
   - QR code generation & display.
   - Twitter/X share (pre-filled OGP data).
   - LINE share.
   - Facebook share.
5. Shared link must include OGP metadata:
   - Image: composite image.
   - Title: “ARキャラクターを作成しました”.
   - Description: first 100 characters of narrative.
   - No creator personal data stored in metadata.

### Step G – Public Gallery
1. User taps “Gallery”. System fetches all published works (public by default) via paginated API (20 items per page).
2. Render a 2-column grid of thumbnails (composite images) with infinite scroll; load next 20 on reaching bottom.
3. On tap, open detail view with:
   - Full narrative text.
   - Composite image.
   - AR View button (with same fallback handling as Step E).
   - Share button.
4. Display license information within the detail view.

## 8. Data Lifecycle & Retention
- In-progress data (text inputs, intermediate images, generation jobs) stored in session/local storage and/or temporary backend tables; auto-delete after 30 minutes of inactivity.
- SessionStorage images expire after 30 minutes.
- Incomplete generation jobs auto-cancel after 30 minutes; backend cleans associated temporary assets.
- If the browser tab is closed or refreshed during generation, immediately cancel jobs and flag the session for user notification on return.
- Unfinished sessions older than 24 hours are purged automatically.
- Completed creations retained for 7 days, then permanently deleted from database and storage (no recovery).
- All deletions are hard deletes; no archival beyond Supabase real-time backup processes.
- Access logs are not stored to save space.

## 9. Error Handling & Retry Policy
- External API errors trigger up to three retries before user-facing error.
- Localized error messages:
  - Japanese: 「生成に失敗しました。もう一度お試しください」
  - English: "Generation failed. Please try again"
- Network failures show “インターネット接続を確認してください / Check your internet connection”.
- When partial success occurs, display successful results while indicating which stages failed and allow manual retry.
- Provide “Back” button to return to the previous step after any failure.
- Record error details (including step, API, response code) in dedicated error log DB table with session ID and IP data.

## 10. Moderation & Compliance
- Run all user-provided text through OpenAI Moderation API plus NG word list.
- Reject content flagged as inappropriate with localized message:
  - Japanese: 「不適切な内容が含まれています」
  - English: "Inappropriate content detected"
- Log violations with IP, session ID, and offending content snippet for auditing.
- Generated narratives must be sanitized to remove NG words before display or storage.
- All media carries CC BY-SA 4.0 attribution; ensure UI displays license and include in share metadata.

## 11. Analytics Requirements
- Integrate GA4 event tracking:
  - `page_view`
  - `generation_start`
  - `generation_complete`
  - `generation_error`
  - `share_action` (with method parameter)
- Maintain dashboard showing completion rate and drop-off rate per step.
- Compute reports highlighting popular stage-character combinations (e.g., by tags or keywords).
- Ensure no personally identifiable information is sent to GA4.

## 12. UI/UX Guidelines
- Mobile-first layout supporting 375px–768px widths; enforce portrait orientation. On landscape, display “縦画面でご利用ください / Please use portrait mode.”
- Use system fonts; no dark mode support.
- Minimum tap target size: 44×44 px.
- Provide bilingual UI toggled at Step 0 and persisted.
- Vertical scroll lists for image selections; highlight selection with accessible contrast.
- Progress bar in Step B visualizes C1–C3 progress.
- Always display license notice on result and share screens.

## 13. Performance & Scalability Targets
- Initial page load under 5 seconds on target devices (3G/4G conditions assumed).
- Stage and character image generation target completion under 60 seconds; model generation under 120 seconds.
- Concurrent user capacity: 20 active sessions.
- Vercel Function calls must offload long-running jobs to background queues to respect 10-second execution limit.
- Inform users when generation exceeds expected time thresholds (30s for images, 30s for model before showing waiting message).

## 14. Security & Privacy Considerations
- No user authentication; rely on session IDs (stored in sessionStorage) and IP for rate limiting.
- Enforce HTTPS for all endpoints.
- Remove EXIF/location data from user uploads immediately.
- Do not store personal identifiers or access logs; only retain necessary metadata for rate limiting and error diagnosis.
- Ensure temporary assets are deleted according to retention policy.
- Provide transparency on data handling via Terms presented at Step 0.

## 15. Open Questions & Future Enhancements
- Determine tagging strategy for “popular combinations” analytics (keywords vs. manual tags).
- Confirm timezone used for daily limits (user local vs. UTC).
- Define precise fallback UX for AR-unsupported devices (e.g., instructions for 3D viewer).
- Evaluate need for push notifications or email reminders (currently out of scope).

---
This specification should be reviewed with design, engineering, and legal teams to finalize terminology, API contracts, and compliance requirements before implementation.
