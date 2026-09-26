'use client';
import { useState, useTransition } from 'react';
import { Button, Card, CardContent, Input } from '@snapbox/ui';
import {
  savePaymentConfig,
  testPaymentConnection,
} from '@/app/(owner-dashboard)/owner-dashboard/payment-settings/actions';
import {
  PAYMENT_MODES,
  PAYMENT_PROVIDERS,
  providerLabels,
  type PaymentConfigRecord,
} from '@/lib/owner-dashboard/payment-contract';

export function PaymentSettingsView({ configs }: { configs: PaymentConfigRecord[] }) {
  const [provider, setProvider] = useState<(typeof PAYMENT_PROVIDERS)[number]>(
    configs[0]?.provider ?? 'MIDTRANS',
  );
  const current = configs.find((item) => item.provider === provider);
  const [mode, setMode] = useState<(typeof PAYMENT_MODES)[number]>(current?.mode ?? 'SANDBOX');
  const [merchantId, setMerchantId] = useState(current?.merchantId ?? '');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [primary, setPrimary] = useState(current?.isPrimary ?? configs.length === 0);
  const [active, setActive] = useState(current?.isActive ?? true);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function input() {
    return {
      provider,
      mode,
      merchantId,
      apiKey: apiKey || undefined,
      secretKey: secretKey || undefined,
      isPrimary: primary,
      isActive: active,
    };
  }
  function run(test: boolean) {
    startTransition(async () => {
      const result = test ? await testPaymentConnection(input()) : await savePaymentConfig(input());
      setMessage(result.message);
      if (result.ok) {
        setApiKey('');
        setSecretKey('');
      }
    });
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Payment gateway</h1>
        <p className="text-muted-foreground mt-2">Kelola gateway pembayaran B2C tenant.</p>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 font-semibold">
        {message}
      </p>
      <Card className="border-4 shadow-[6px_6px_0_0_var(--color-border)]">
        <CardContent className="space-y-5 pt-6">
          <label className="block font-semibold">
            Provider
            <select
              className="mt-1 min-h-11 w-full border-2 border-border bg-background px-3"
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
            >
              {PAYMENT_PROVIDERS.map((item) => (
                <option key={item}>{providerLabels[item]}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-5">
            {PAYMENT_MODES.map((item) => (
              <label key={item} className="font-semibold">
                <input type="radio" checked={mode === item} onChange={() => setMode(item)} />{' '}
                {item === 'SANDBOX' ? 'Sandbox' : 'Production'}
              </label>
            ))}
          </div>
          <label className="block font-semibold">
            Merchant ID
            <Input
              className="mt-1"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
            />
          </label>
          <label className="block font-semibold">
            API key
            <Input
              className="mt-1"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={current?.hasApiKey ? 'Tersimpan, isi untuk mengganti' : ''}
            />
          </label>
          <label className="block font-semibold">
            Secret key
            <Input
              className="mt-1"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={current?.hasSecretKey ? 'Tersimpan, isi untuk mengganti' : ''}
            />
          </label>
          <label className="flex gap-2 font-semibold">
            <input
              type="checkbox"
              checked={primary}
              onChange={(e) => setPrimary(e.target.checked)}
            />{' '}
            Jadikan primary
          </label>
          <label className="flex gap-2 font-semibold">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{' '}
            Aktif
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={pending} onClick={() => run(true)}>
              Test Connection
            </Button>
            <Button type="button" disabled={pending} onClick={() => run(false)}>
              Simpan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
