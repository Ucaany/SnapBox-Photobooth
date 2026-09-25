'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Textarea,
} from '@snapbox/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  EMAIL_TEMPLATE_KEYS,
  SETTING_KEYS,
  TEMPLATE_PLACEHOLDERS,
  settingValueSchemas,
  type EmailTemplate,
  type EmailTemplateKey,
  type SettingKey,
  type SettingsSnapshot,
} from '@/lib/ceo-dashboard/settings-contract';

import { updateSetting } from '@/app/(ceo-dashboard)/ceo-dashboard/settings/actions';

import { PageIntro, Panel, StatusBadge } from '../panel';

const TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  'email_template.tenant_invite': 'Undangan tenant',
  'email_template.invoice_b2b': 'Invoice B2B',
  'email_template.subscription_expiring': 'Peringatan langganan berakhir',
};

const FLAG_LABELS: Record<string, { label: string; description: string }> = {
  [SETTING_KEYS.flagKioskThemeCustomizer]: {
    label: 'Kustomisasi tema kiosk',
    description: 'Membuka theme customizer untuk tenant Growth dan Enterprise.',
  },
  [SETTING_KEYS.flagAdvancedPromoBatch]: {
    label: 'Batch voucher lanjutan',
    description: 'Mengaktifkan pembuatan voucher massal; ditujukan untuk Enterprise.',
  },
  [SETTING_KEYS.flagWebDeviceConsole]: {
    label: 'Konsol perangkat web',
    description: 'Fallback konsol perangkat berbasis web bila aplikasi desktop tidak tersedia.',
  },
};

/** Contoh nilai untuk pratinjau; BUKAN data tenant nyata. */
const PREVIEW_VALUES: Record<string, string> = {
  tenantName: 'Nama Bisnis',
  ownerName: 'Nama Owner',
  inviteUrl: 'https://snapbox.id/aktivasi/contoh',
  invoiceNumber: 'INV-CONTOH-001',
  invoiceAmount: 'Rp 1.500.000',
  dueDate: '31 Desember 2026',
  planName: 'Growth',
  expiresAt: '31 Desember 2026',
};

type Feedback = { tone: 'ok' | 'error'; message: string } | null;

/**
 * Pengaturan global (PRD Task 1.9).
 *
 * Nilai NYATA dari `platform_settings`, editable, dan disimpan satu key per
 * action. Tidak ada SMTP, API key, atau secret yang pernah dirender di sini;
 * nilai sensitif tetap di env/secret manager.
 */
export function SettingsView({ settings }: { readonly settings?: SettingsSnapshot }) {
  if (!settings) {
    return (
      <section className="ceo-panel-static" role="status">
        <p className="ceo-muted">Pengaturan belum dapat dimuat.</p>
      </section>
    );
  }

  return (
    <>
      <PageIntro
        title="Pengaturan global"
        description="Kontak penjualan, template email, dan feature flag."
      >
        <StatusBadge tone="baik">Tersimpan di database</StatusBadge>
      </PageIntro>

      <Panel
        title="Catatan keamanan"
        description="Yang sengaja TIDAK pernah ditampilkan."
        example={false}
      >
        <p className="ceo-hint">
          Kunci API master, secret SMTP, dan kredensial gateway tidak disimpan di tabel pengaturan
          maupun dirender di UI. Nilai sensitif tetap di environment/secret manager dan hanya diisi
          operator terautentikasi.
        </p>
      </Panel>

      <div className="ceo-settings">
        <ContactPanel settings={settings} />
        <FlagPanel settings={settings} />
        {EMAIL_TEMPLATE_KEYS.map((key) => (
          <TemplatePanel key={key} templateKey={key} template={settings.templates[key]} />
        ))}
      </div>
    </>
  );
}

function useSettingSaver() {
  const router = useRouter();
  const [pendingKey, setPendingKey] = React.useState<SettingKey | null>(null);
  const [feedback, setFeedback] = React.useState<Record<string, Feedback>>({});

  const save = React.useCallback(
    async (key: SettingKey, value: unknown) => {
      setPendingKey(key);
      setFeedback((prev) => ({ ...prev, [key]: null }));
      try {
        const result = await updateSetting({ key, value });
        setFeedback((prev) => ({
          ...prev,
          [key]: { tone: result.ok ? 'ok' : 'error', message: result.message },
        }));
        if (result.ok) router.refresh();
      } catch {
        setFeedback((prev) => ({
          ...prev,
          [key]: { tone: 'error', message: 'Penyimpanan gagal karena gangguan koneksi.' },
        }));
      } finally {
        setPendingKey(null);
      }
    },
    [router],
  );

  return { save, pendingKey, feedback };
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      className={feedback.tone === 'ok' ? 'ceo-feedback' : 'ceo-feedback ceo-feedback-error'}
      role={feedback.tone === 'ok' ? 'status' : 'alert'}
    >
      {feedback.message}
    </p>
  );
}

function ContactPanel({ settings }: { settings: SettingsSnapshot }) {
  const { save, pendingKey, feedback } = useSettingSaver();
  const [whatsapp, setWhatsapp] = React.useState(settings.whatsappNumber);
  const [replyTo, setReplyTo] = React.useState(settings.emailReplyTo);

  React.useEffect(() => setWhatsapp(settings.whatsappNumber), [settings.whatsappNumber]);
  React.useEffect(() => setReplyTo(settings.emailReplyTo), [settings.emailReplyTo]);

  return (
    <Panel
      title="Kontak dan kanal penjualan"
      description="Nilai operasional yang boleh dibaca UI."
      example={false}
    >
      <div className="ceo-form">
        <div className="ceo-field">
          <Label htmlFor="sales-wa">Nomor WhatsApp penjualan</Label>
          <Input
            id="sales-wa"
            inputMode="tel"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            placeholder="6281234567890"
          />
          <p className="ceo-hint">Digit saja, format internasional tanpa tanda +.</p>
        </div>
        <Button
          type="button"
          disabled={pendingKey === SETTING_KEYS.salesWhatsappNumber}
          onClick={() => void save(SETTING_KEYS.salesWhatsappNumber, whatsapp)}
        >
          {pendingKey === SETTING_KEYS.salesWhatsappNumber ? 'Menyimpan...' : 'Simpan nomor'}
        </Button>
        <FeedbackLine feedback={feedback[SETTING_KEYS.salesWhatsappNumber] ?? null} />

        <div className="ceo-field">
          <Label htmlFor="reply-email">Email balasan default</Label>
          <Input
            id="reply-email"
            type="email"
            value={replyTo}
            onChange={(event) => setReplyTo(event.target.value)}
            placeholder="halo@snapbox.id"
          />
          <p className="ceo-hint">Dipakai sebagai reply-to template email.</p>
        </div>
        <Button
          type="button"
          disabled={pendingKey === SETTING_KEYS.emailDefaultReplyTo}
          onClick={() => void save(SETTING_KEYS.emailDefaultReplyTo, replyTo)}
        >
          {pendingKey === SETTING_KEYS.emailDefaultReplyTo ? 'Menyimpan...' : 'Simpan email'}
        </Button>
        <FeedbackLine feedback={feedback[SETTING_KEYS.emailDefaultReplyTo] ?? null} />
      </div>
    </Panel>
  );
}

function FlagPanel({ settings }: { settings: SettingsSnapshot }) {
  const { save, pendingKey, feedback } = useSettingSaver();

  return (
    <Panel title="Feature flag" description="Saklar rilis fitur lintas tenant." example={false}>
      <div className="ceo-form">
        {Object.entries(settings.flags).map(([key, value]) => {
          const meta = FLAG_LABELS[key];
          return (
            <div key={key} className="ceo-feature-row">
              <label htmlFor={`flag-${key}`}>{meta?.label ?? key}</label>
              <Switch
                id={`flag-${key}`}
                checked={value}
                disabled={pendingKey === key}
                onCheckedChange={(checked) => void save(key as SettingKey, checked)}
              />
              {meta ? <p className="ceo-muted">{meta.description}</p> : null}
            </div>
          );
        })}
        <FeedbackLine feedback={feedback[SETTING_KEYS.flagKioskThemeCustomizer] ?? null} />
      </div>
    </Panel>
  );
}

function TemplatePanel({
  templateKey,
  template,
}: {
  templateKey: EmailTemplateKey;
  template: EmailTemplate;
}) {
  const { save, pendingKey, feedback } = useSettingSaver();
  const [draft, setDraft] = React.useState<EmailTemplate>(template);
  const [validation, setValidation] = React.useState<string | null>(null);

  React.useEffect(() => setDraft(template), [template]);

  const placeholders = TEMPLATE_PLACEHOLDERS[templateKey];

  function submit() {
    const parsed = settingValueSchemas[templateKey].safeParse(draft);
    if (!parsed.success) {
      setValidation(parsed.error.issues[0]?.message ?? 'Template tidak valid.');
      return;
    }
    setValidation(null);
    void save(templateKey, parsed.data);
  }

  return (
    <Card className="ceo-setting-group">
      <CardHeader>
        <CardTitle className="text-base">{TEMPLATE_LABELS[templateKey]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="ceo-form">
          <div className="ceo-field">
            <Label htmlFor={`${templateKey}-subject`}>Subjek</Label>
            <Input
              id={`${templateKey}-subject`}
              value={draft.subject}
              maxLength={200}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            />
          </div>
          <div className="ceo-field">
            <Label htmlFor={`${templateKey}-body`}>Isi</Label>
            <Textarea
              id={`${templateKey}-body`}
              value={draft.body}
              rows={6}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            />
            <p className="ceo-hint">
              Placeholder: {placeholders.map((item) => `{{${item}}}`).join(', ')}. Hanya placeholder
              ini yang diterima.
            </p>
          </div>

          <div className="ceo-field">
            <span className="ceo-feature-label">Pratinjau (contoh nilai)</span>
            <p className="ceo-hint">{renderPreview(draft, placeholders)}</p>
          </div>

          {validation ? (
            <p className="ceo-error" role="alert">
              {validation}
            </p>
          ) : null}

          <Button type="button" disabled={pendingKey === templateKey} onClick={submit}>
            {pendingKey === templateKey ? 'Menyimpan...' : 'Simpan template'}
          </Button>
          <FeedbackLine feedback={feedback[templateKey] ?? null} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Pratinjau teks sederhana: mengganti placeholder dengan contoh, tanpa HTML. */
function renderPreview(template: EmailTemplate, placeholders: readonly string[]): string {
  const allowed = new Set<string>(placeholders);
  const replace = (text: string) =>
    text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g, (whole, name: string) =>
      allowed.has(name) ? (PREVIEW_VALUES[name] ?? whole) : whole,
    );
  const subject = replace(template.subject);
  const body = replace(template.body);
  return subject ? `${subject} — ${body.slice(0, 160)}` : body.slice(0, 160);
}
