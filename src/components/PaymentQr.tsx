const UPI_ID = "9826049083@ybl";
const PAYEE_NAME = "Coudiefy Jewellers";
const BANK_ACCOUNTS = [
  {
    name: "Sourabh Bhandari",
    accountNo: "63011319379",
    bank: "SBI",
    ifsc: "SBIN0030029",
    branch: "Barwaha",
  },
  {
    name: "Coudiefy Jewellers",
    accountNo: "31420425663",
    bank: "SBI",
    ifsc: "SBIN0030029",
    branch: "Barwaha",
  },
];

function formatAmount(amount?: number) {
  if (!amount || amount <= 0) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildUpiUrl() {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: PAYEE_NAME,
    cu: "INR",
  });

  return `upi://pay?${params.toString()}`;
}

export function PaymentQr({ amount, compact = false }: { amount?: number; compact?: boolean }) {
  const upiUrl = buildUpiUrl();
  const payableAmount = formatAmount(amount);
  const qrSize = compact ? 104 : 124;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&margin=8&data=${encodeURIComponent(upiUrl)}`;

  return (
    <div className="w-full max-w-3xl rounded-sm border border-slate-300 bg-white text-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-3 py-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Details</div>
        {payableAmount && (
          <div className="text-xs font-bold text-slate-900">
            Payable: <span>{payableAmount}</span>
          </div>
        )}
      </div>

      <div className={`grid ${compact ? "grid-cols-[120px_1fr]" : "grid-cols-1 sm:grid-cols-[148px_1fr]"} gap-3 p-3`}>
        <div className="flex flex-col items-center justify-center border border-slate-200 bg-slate-50 p-2 text-center">
          <img
            src={qrSrc}
            alt={`UPI QR for ${UPI_ID}`}
            width={qrSize}
            height={qrSize}
            className="bg-white object-contain"
          />
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Scan to Pay</div>
          <div className="break-all text-[11px] font-semibold leading-tight text-slate-900">{UPI_ID}</div>
        </div>

        <div className="overflow-hidden border border-slate-200">
          <div className="grid grid-cols-[1.1fr_1fr_0.85fr_0.9fr] bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <div className="border-r border-slate-200 px-2 py-1.5">Account Name</div>
            <div className="border-r border-slate-200 px-2 py-1.5">A/c No</div>
            <div className="border-r border-slate-200 px-2 py-1.5">IFSC</div>
            <div className="px-2 py-1.5">Branch</div>
          </div>
          {BANK_ACCOUNTS.map((account) => (
            <div key={account.accountNo} className="grid grid-cols-[1.1fr_1fr_0.85fr_0.9fr] border-t border-slate-200 text-[11px] leading-tight">
              <div className="border-r border-slate-200 px-2 py-2 font-bold">{account.name}</div>
              <div className="border-r border-slate-200 px-2 py-2 font-semibold">{account.accountNo}</div>
              <div className="border-r border-slate-200 px-2 py-2 font-semibold">{account.ifsc}</div>
              <div className="px-2 py-2">{account.bank}, {account.branch}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
