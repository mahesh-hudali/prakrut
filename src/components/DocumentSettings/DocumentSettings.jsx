import {
  BLOCK_STYLES,
  KANNADA_FONTS,
  PAGE_PRESETS,
} from "../../models/documentModel";
import "./DocumentSettings.css";

function NumberField({ label, value, min = 0, max = 5, step = 0.05, onChange, suffix = '"' }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <span className="settings-field-input">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <em>{suffix}</em>
      </span>
    </label>
  );
}

export default function DocumentSettings({ settings, onChangeSettings }) {
  const preset = PAGE_PRESETS[settings.pageSizeId] ?? PAGE_PRESETS.custom;
  const isCustom = settings.pageSizeId === "custom";

  const patch = (partial) => {
    onChangeSettings({ ...settings, ...partial });
  };

  const patchMargins = (partial) => {
    onChangeSettings({
      ...settings,
      margins: { ...settings.margins, ...partial },
    });
  };

  const patchTypography = (partial) => {
    onChangeSettings({
      ...settings,
      typography: { ...settings.typography, ...partial },
    });
  };

  const onPresetChange = (id) => {
    const next = PAGE_PRESETS[id];
    if (!next) return;
    patch({
      pageSizeId: id,
      pageWidth: next.width,
      pageHeight: next.height,
    });
  };

  return (
    <aside className="document-settings" aria-label="Page and typography settings">
      <section>
        <h2>Page size</h2>
        <label className="settings-field">
          <span>Preset</span>
          <select
            value={settings.pageSizeId}
            onChange={(e) => onPresetChange(e.target.value)}
          >
            {Object.values(PAGE_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-row">
          <NumberField
            label="Width"
            value={settings.pageWidth}
            min={3}
            max={12}
            onChange={(pageWidth) =>
              patch({ pageSizeId: "custom", pageWidth })
            }
          />
          <NumberField
            label="Height"
            value={settings.pageHeight}
            min={4}
            max={16}
            onChange={(pageHeight) =>
              patch({ pageSizeId: "custom", pageHeight })
            }
          />
        </div>
        {!isCustom && (
          <p className="settings-hint">
            {preset.label}: {preset.width}" × {preset.height}"
          </p>
        )}
      </section>

      <section>
        <h2>Margins</h2>
        <div className="settings-row">
          <NumberField
            label="Top"
            value={settings.margins.top}
            onChange={(top) => patchMargins({ top })}
          />
          <NumberField
            label="Bottom"
            value={settings.margins.bottom}
            onChange={(bottom) => patchMargins({ bottom })}
          />
        </div>
        <div className="settings-row">
          <NumberField
            label="Left"
            value={settings.margins.left}
            onChange={(left) => patchMargins({ left })}
          />
          <NumberField
            label="Right"
            value={settings.margins.right}
            onChange={(right) => patchMargins({ right })}
          />
        </div>
        <NumberField
          label="Gutter"
          value={settings.margins.gutter}
          onChange={(gutter) => patchMargins({ gutter })}
        />
      </section>

      <section>
        <h2>Typography</h2>
        <label className="settings-field">
          <span>Font</span>
          <select
            value={settings.typography.fontFamilyId}
            onChange={(e) => patchTypography({ fontFamilyId: e.target.value })}
          >
            {KANNADA_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-row">
          <NumberField
            label="Size"
            value={settings.typography.fontSizePt}
            min={8}
            max={36}
            step={0.5}
            suffix="pt"
            onChange={(fontSizePt) => patchTypography({ fontSizePt })}
          />
          <label className="settings-field">
            <span>Weight</span>
            <select
              value={settings.typography.fontWeight}
              onChange={(e) =>
                patchTypography({ fontWeight: Number(e.target.value) })
              }
            >
              <option value={400}>Regular</option>
              <option value={500}>Medium</option>
              <option value={600}>Semibold</option>
              <option value={700}>Bold</option>
            </select>
          </label>
        </div>
        <div className="settings-row">
          <NumberField
            label="Line height"
            value={settings.typography.lineHeight}
            min={1}
            max={2.5}
            step={0.05}
            suffix=""
            onChange={(lineHeight) => patchTypography({ lineHeight })}
          />
          <NumberField
            label="Letter"
            value={settings.typography.letterSpacingEm}
            min={-0.05}
            max={0.2}
            step={0.01}
            suffix="em"
            onChange={(letterSpacingEm) =>
              patchTypography({ letterSpacingEm })
            }
          />
        </div>
        <div className="settings-row">
          <NumberField
            label="Paragraph"
            value={settings.typography.paragraphSpacingEm}
            min={0}
            max={2}
            step={0.05}
            suffix="em"
            onChange={(paragraphSpacingEm) =>
              patchTypography({ paragraphSpacingEm })
            }
          />
          <NumberField
            label="First line"
            value={settings.typography.firstLineIndentEm}
            min={0}
            max={4}
            step={0.1}
            suffix="em"
            onChange={(firstLineIndentEm) =>
              patchTypography({ firstLineIndentEm })
            }
          />
        </div>
        <label className="settings-field">
          <span>Alignment</span>
          <select
            value={settings.typography.textAlign}
            onChange={(e) => patchTypography({ textAlign: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Paragraph style</h2>
        <p className="settings-hint">
          Applied to the focused paragraph via the toolbar.
        </p>
        <ul className="style-legend">
          {Object.values(BLOCK_STYLES).map((style) => (
            <li key={style.id}>{style.label}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
