import {
  Field,
  FieldRow,
  NumberInput,
  PanelSection,
  SegmentedControl,
  Select,
} from "../../design-system";
import { KANNADA_FONTS, PAGE_PRESETS } from "../../models/documentModel";

const WEIGHTS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
];

const ALIGNMENTS = [
  { value: "left", label: "Align left", icon: "alignLeft" },
  { value: "center", label: "Center", icon: "alignCenter" },
  { value: "right", label: "Align right", icon: "alignRight" },
  { value: "justify", label: "Justify", icon: "alignJustify" },
];

/** Page size, margins and body typography for the whole book. */
export default function DocumentSettings({ settings, onChangeSettings }) {
  const patch = (partial) => onChangeSettings({ ...settings, ...partial });
  const patchMargins = (partial) =>
    onChangeSettings({ ...settings, margins: { ...settings.margins, ...partial } });
  const patchTypography = (partial) =>
    onChangeSettings({ ...settings, typography: { ...settings.typography, ...partial } });

  const onPresetChange = (id) => {
    const next = PAGE_PRESETS[id];
    if (!next) return;
    patch({ pageSizeId: id, pageWidth: next.width, pageHeight: next.height });
  };

  const typo = settings.typography;

  return (
    <>
      <PanelSection title="Page">
        <Field label="Trim size">
          <Select
            value={settings.pageSizeId}
            onChange={(event) => onPresetChange(event.target.value)}
            options={Object.values(PAGE_PRESETS).map((p) => ({ value: p.id, label: p.label }))}
          />
        </Field>
        <FieldRow>
          <Field label="Width">
            <NumberInput
              suffix="in"
              value={settings.pageWidth}
              min={3}
              max={12}
              step={0.05}
              onChange={(pageWidth) => patch({ pageSizeId: "custom", pageWidth })}
            />
          </Field>
          <Field label="Height">
            <NumberInput
              suffix="in"
              value={settings.pageHeight}
              min={4}
              max={16}
              step={0.05}
              onChange={(pageHeight) => patch({ pageSizeId: "custom", pageHeight })}
            />
          </Field>
        </FieldRow>
      </PanelSection>

      <PanelSection title="Margins">
        <FieldRow>
          {["top", "bottom"].map((side) => (
            <Field key={side} label={side === "top" ? "Top" : "Bottom"}>
              <NumberInput
                suffix="in"
                value={settings.margins[side]}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => patchMargins({ [side]: value })}
              />
            </Field>
          ))}
        </FieldRow>
        <FieldRow>
          {["left", "right"].map((side) => (
            <Field key={side} label={side === "left" ? "Inside" : "Outside"}>
              <NumberInput
                suffix="in"
                value={settings.margins[side]}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => patchMargins({ [side]: value })}
              />
            </Field>
          ))}
        </FieldRow>
        <Field label="Gutter" hint="Extra space on the binding edge">
          <NumberInput
            suffix="in"
            value={settings.margins.gutter}
            min={0}
            max={2}
            step={0.05}
            onChange={(gutter) => patchMargins({ gutter })}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Body text">
        <Field label="Font">
          <Select
            value={typo.fontFamilyId}
            onChange={(event) => patchTypography({ fontFamilyId: event.target.value })}
            options={KANNADA_FONTS.map((font) => ({ value: font.id, label: font.label }))}
          />
        </Field>
        <FieldRow>
          <Field label="Size">
            <NumberInput
              suffix="pt"
              value={typo.fontSizePt}
              min={8}
              max={36}
              step={0.5}
              onChange={(fontSizePt) => patchTypography({ fontSizePt })}
            />
          </Field>
          <Field label="Weight">
            <Select
              value={typo.fontWeight}
              onChange={(event) => patchTypography({ fontWeight: Number(event.target.value) })}
              options={WEIGHTS}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Line height">
            <NumberInput
              value={typo.lineHeight}
              min={1}
              max={2.5}
              step={0.05}
              onChange={(lineHeight) => patchTypography({ lineHeight })}
            />
          </Field>
          <Field label="Letter spacing">
            <NumberInput
              suffix="em"
              value={typo.letterSpacingEm}
              min={-0.05}
              max={0.2}
              step={0.01}
              onChange={(letterSpacingEm) => patchTypography({ letterSpacingEm })}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Paragraph gap">
            <NumberInput
              suffix="em"
              value={typo.paragraphSpacingEm}
              min={0}
              max={2}
              step={0.05}
              onChange={(paragraphSpacingEm) => patchTypography({ paragraphSpacingEm })}
            />
          </Field>
          <Field label="First-line indent">
            <NumberInput
              suffix="em"
              value={typo.firstLineIndentEm}
              min={0}
              max={4}
              step={0.1}
              onChange={(firstLineIndentEm) => patchTypography({ firstLineIndentEm })}
            />
          </Field>
        </FieldRow>
        <Field label="Default alignment" group>
          <SegmentedControl
            label="Default alignment"
            iconOnly
            options={ALIGNMENTS}
            value={typo.textAlign}
            onChange={(textAlign) => patchTypography({ textAlign })}
          />
        </Field>
      </PanelSection>
    </>
  );
}
