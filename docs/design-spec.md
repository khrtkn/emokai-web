# SOFU AR Character Creator – Design Specification

## 1. Document Control
- **Document ID**: SOFU-DES-001
- **Version**: 0.1 (draft)
- **Last Updated**: 2025-02-14
- **Author**: Codex assistant
- **Source Assets**: Figma `ScreenMessage`, `ScreenInput`, `ScreenImageSelection`, `ScreenEmokaiCard`, `ScreenCamera` components (375×812)

## 2. Design Principles
- Reinforce the mobile-first, portrait-only experience described in the product specification.
- Provide a consistent, low-distraction canvas so AI-generated media is the visual focus.
- Support bilingual content (Japanese/English) and dynamic copy lengths without layout breakage.
- Maintain minimum 44×44 px touch targets and legible typography with a dark background (#222222) for contrast.

## 3. Color & Typography Tokens
- **Background**: `#222222` (primary canvas for all screens).
- **Primary Text**: `#FFFFFF` on dark backgrounds; ensure contrast ratio ≥ 4.5:1.
- **Secondary Text**: `rgba(255,255,255,0.7)` for helper copy, captions, and placeholder text.
- **Dividers & Borders**: `rgba(255,255,255,0.12)` 1 px.
- **Highlight / Selection**: `#00D8A4` (recommended) 2 px stroke and 8 px radius around selected tiles (not in Figma assets but required for accessibility and clarity).
- **Font Stack**: `-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", sans-serif`. (Figma placeholder uses Pixelify Sans for “Scroll”; replace with system font in production.)

## 4. Global Layout Rules
- Canvas size 375×812 (iPhone 14 reference) with 16 px lateral padding unless media requires full bleed.
- Header height fixed at 72 px; contents spaced using 16 px padding and `space-between` alignment for title and primary action.
- Body content organized vertically with consistent 24–48 px inter-section spacing.
- Scrollable content spans from below the header divider to the keyboard/top CTA depending on screen type.
- Safe-area insets respected; bottom padding extends to accommodate system gesture area.

## 5. Shared Components

### 5.1 Header
- Structure: left-aligned screen title, right-aligned primary CTA (`次へ` / `Next`). Optional back button on the left when needed.
- Interaction: CTA disabled state for validation; underline or opacity change for disabled (recommend 50% opacity).
- Variants: Terms acceptance (CTA `同意する`), selection steps (`次へ`), AR completion (`保存`).

### 5.2 Divider
- 1 px horizontal rule spanning full width.
- Color `rgba(255,255,255,0.12)`; use to separate header, instructions, and content blocks.

### 5.3 Instruction Banner
- Height 44–72 px depending on copy length.
- Content scrolls horizontally when exceeding available width (marquee). Provide pause on tap for accessibility.
- Background: `rgba(255,255,255,0.08)` with 8 px corner radius.
- Iconography: Optional info icon at leading edge.

### 5.4 Message Block (ScreenMessage)
- Centered column with 32 px vertical padding.
- Use for terms, capability notices, and system alerts.
- Supports primary message, secondary explanation, and CTA stack.

### 5.5 Text Input (ScreenInput)
- Multiline area 274 px height with internal padding 16 px.
- Placeholder in secondary text color; label sits above input if required.
- Provide character counter and localization-aware line height (1.4 recommended).

### 5.6 Image Tile Grid (ScreenImageSelection)
- Four 1:1 tiles stacked vertically within scroll area (Figma placeholder uses `ImageTile` instance size 375×562.5 for 4 items with spacing).
- Each tile includes image preview, selection frame, and label overlay.
- Selection: highlight border with 2 px accent, overlay checkmark top-right.
- No enlarged preview; tap toggles selection, second tap to confirm or use `決定` button below grid.

### 5.7 Card Component (ScreenEmokaiCard)
- Used for narrative display.
- Sections: header row with No., name, host; hero image slot; body text for story; license footnote.
- Spacing: 24 px between sections; card padding 16 px; corner radius 16 px.
- Background: `rgba(255,255,255,0.05)`.

### 5.8 Camera / AR Module (ScreenCamera)
- Preview area full width, 1:1 or 16:9 aspect depending on state.
- Overlay controls anchored bottom center (shutter 64 px diameter) with supporting buttons (gallery access, flash) 48 px.
- Instruction text pinned top center, fades out after 3 seconds on user interaction.

### 5.9 Progress Bar
- Displayed post-selection on Step B while Steps C1–C3 run.
- Three parallel tracks with status icons (pending, running, complete, error).
- Placement: fixed to top of content area below header, 16 px padding all sides.

## 6. Screen Specifications

### 6.1 Initial Messaging / Terms (`ScreenMessage`)
- Use for Step 0 flows: device detection message, language selection prompt, terms acceptance.
- Layout: header + primary message block. Provide segmented control for language (JP/EN) and list of required permissions.
- CTA: `同意して進む / Accept and continue`; disabled until checkbox ticked.

### 6.2 Text Input (`ScreenInput`)
- Purpose: Stage description (Step A) or character description (Step B).
- Header title updates per flow: `ステージの説明` / `Describe Stage`, `キャラクターの説明` / `Describe Character`.
- Instruction banner shows contextual tips (marquee when long text).
- Input field spans majority of viewport; keyboard pushes content above safe-area. Provide persistent `次へ` button within header; disable until text meets validation (≥ 10 characters recommended).

### 6.3 Image Source Selection (modal, not in Figma)
- Follows product requirement: two-button sheet `カメラで撮影` / `ライブラリから選択`.
- Buttons 56 px height, full width, 16 px top/bottom padding.

### 6.4 Image Selection (`ScreenImageSelection` variant 1)
- Use for selecting AI-generated stage isometrics.
- Instruction banner copy: `あなたのイメージに合うステージを選択してください`.
- Grid displays four AI outputs (vertical scroll). Each tile: 8 px separation, 12 px radius.
- Under grid, include helper text about re-running generation if unsatisfied and `再生成` button (ghost style).

### 6.5 Emotion Selection (`ScreenImageSelection` variant 2)
- Provided Figma variant includes scroll indicator (“Scroll”).
- Use for optional emotion tagging (if implemented). Replace Pixelify Sans with system font; align indicator with bottom of instruction banner.
- Allow multi-select; use pill chips (44 px height) below grid.

### 6.6 Character Selection (`ScreenImageSelection` variant 3)
- Same layout as stage selection with updated instruction: `キャラクターを選択してください`.
- Selection persists until user taps `決定`; allow `戻る` to re-run generation.

### 6.7 Narrative Card (`ScreenEmokaiCard`)
- Step D display. Title = character name; subtitle host (user display name or “Guest”).
- Body text area auto-expands; use scroll inside card when > 70% viewport height.
- Include license notice and timestamp in footer.

### 6.8 Camera / AR Screen (`ScreenCamera`)
- Header action becomes `保存` once AR capture available.
- Instruction banner rotates through guidance: plane detection, pinch to scale, etc.
- Provide fallback 3D viewer in same component: swap camera feed with model viewer, reposition shutter to bottom center for screenshot capture.

## 7. Interaction & State Behaviors
- **Session Lock**: while Steps C1–C3 running, disable navigation away except via confirmation modal (align with product spec).
- **Error States**: instruction banner turns red (`#FF4D4F`) with icon when error occurs; show retry button inline.
- **Loading Skeletons**: image tiles show shimmer placeholders; card shows gradient blocks for text.
- **Localization**: ensure dynamic strings accommodate 30% longer English copy.
- **Accessibility**: provide VoiceOver labels for header buttons, image tiles (“Stage option 1 selected”), and camera controls. Maintain focus order top-to-bottom.

## 8. Asset & Iconography Guidelines
- Icons 24 px default size, white fill with 70% opacity, 8 px padding.
- Use vector assets for share options; align with platform-specific icon sets when launching share sheet.
- Generated media stored at 512×512; display using object-fit `cover`, maintain 12 px border radius.

## 9. Responsive & State Variations
- For screens up to 768 px width (tablets), center the 375 px content column and add blurred backdrop to sides.
- On landscape orientation, overlay modal: “縦画面でご利用ください / Please use portrait mode.” Provide `OK` button to dismiss once device rotates back.
- Handle keyboard safe-area by shifting instruction banner upward and keeping header sticky.

## 10. Open Design Questions
- Should the instruction marquee pause on hover/tap for accessibility? (Recommend yes.)
- Confirm final accent color for selection/highlight to align with brand palette.
- Determine placement of progress indicator for Steps C1–C3 when device has smaller viewport (e.g., iPhone SE).
- Validate whether emotion selection flow remains in scope; remove variant if not required.

---
This design specification should be reviewed with UX and engineering to finalize component variants, accessibility behaviors, and localization patterns before high-fidelity visual design.
