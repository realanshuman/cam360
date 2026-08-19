# Cam360 brand identity

A short, working guide. The goal is a calm, utilitarian product brand: quiet
surfaces, one confident accent, and no decoration that does not carry meaning.

## Positioning

**Cam360 is camera control for the browser.** It sits between your webcam and any
website that asks for it, so you can fix your framing, lighting, and background
without the site needing to support any of it.

One line: *Better video in every browser call.*

## Name

Written **Cam360**. One word, capital C, no space and no hyphen before the number.
Never "Cam 360", "CAM360", or "cam360" in running text.

## Logo

The mark is a camera aperture drawn as a ring with a single gap, wrapped around a
solid centre dot. The gap does double duty: it reads as a rotation arc for the
"360" and as a letter C for "Cam".

| Asset | File | Use |
| --- | --- | --- |
| Primary mark | `logo-mark.svg` | Default everywhere |
| Monochrome mark | `logo-mark-mono.svg` | Single colour print, stamps, dark tiles |
| Favicon | `../web/favicon.svg` | Browser tab |

Rules:

- Keep clear space of at least 25 percent of the mark's width on all sides.
- Minimum size is 16px. The mark was tested to stay legible there.
- The lockup is the mark plus the word Cam360 set in the UI font at 600 weight,
  with a gap equal to half the mark's width. Compose it in markup rather than
  shipping a flattened image, so the wordmark always matches the page font.
- Do not recolour the mark, rotate it, add effects, or place it on a busy photo.

## Colour

The palette is Notion-adjacent on purpose: warm neutrals for everything, and a
single blue that means "active" and nothing else.

| Token | Value | Role |
| --- | --- | --- |
| Ink | `#37352F` | Primary text, monochrome mark |
| Ink secondary | `rgba(55,53,47,0.72)` | Body copy |
| Ink muted | `rgba(55,53,47,0.50)` | Labels, captions |
| Canvas | `#FFFFFF` | Page and card background |
| Sunken | `#F7F6F3` | Grouped controls, quiet panels |
| Line | `rgba(55,53,47,0.10)` | Hairline dividers |
| Signal blue | `#2383E2` | Accent, active state, primary button |
| Signal blue pressed | `#1A6DC0` | Hover and pressed |
| Signal wash | `rgba(35,131,226,0.10)` | Selected background |

Dark surfaces use `#191919` page, `#202020` card, `#2B2B2B` sunken, with text at
90 / 66 / 44 percent white. Signal blue stays the same in both themes.

The accent carries one job. If everything is blue, nothing is.

## Typography

The system UI stack, the same one the product interface uses:

```
ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
```

No web font is loaded. The page renders instantly, matches the operating system,
and never shifts layout while a font downloads.

| Style | Size and weight | Tracking |
| --- | --- | --- |
| Display | 52px / 600 | -0.03em |
| Section heading | 32px / 600 | -0.02em |
| Card heading | 17px / 600 | -0.01em |
| Body | 16px / 400, 1.65 line height | normal |
| Small and captions | 14px / 400 | normal |
| Label | 11px / 600 uppercase | 0.06em |

## Voice

Plain, specific, and calm. We are describing a utility, not selling a dream.

- State what it does, then the limit. Credibility comes from naming the edges.
- Prefer concrete nouns over adjectives. "Blur, colour, scene, or video" beats
  "stunning background options".
- No exclamation marks. No "revolutionary", "seamless", "magical", "effortless".
- Short sentences. Full stops instead of dashes.
- Say "you" and "your camera". Never "users".

Good: "Meet blocks the AI model, so switch to green screen there."
Not: "Enjoy flawless backgrounds anywhere, effortlessly!"

## Imagery

Real interface only. Screenshots are rendered from the shipping code, never mocked
up and never generated. If a concept needs explaining, draw it as a diagram in
markup with the palette above. No stock photography and no synthetic imagery of
people or places.
