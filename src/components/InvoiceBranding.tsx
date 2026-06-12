import { useLocalState } from "@/lib/storage";

export function ShopHeader({ documentLabel, compact }: { documentLabel: string; compact?: boolean }) {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  
  return (
    <div className={`flex items-start justify-between ${compact ? 'mb-4' : 'mb-8'} border-b-2 border-slate-800 pb-4`}>
      <div className="flex items-center gap-4">
        {authUser?.logo ? (
          <img src={authUser.logo} alt="Logo" className="w-20 h-20 object-contain" />
        ) : (
          <div className="w-16 h-16 bg-slate-100 flex items-center justify-center font-bold text-slate-400 rounded">LOGO</div>
        )}
        <div>
          <h1 className="text-2xl font-bold font-display uppercase tracking-wide text-slate-900">{authUser?.shopName || "YOUR SHOP NAME"}</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-sm">{authUser?.address || "Please update your shop address in Settings"}</p>
          <p className="text-sm text-slate-600 mt-0.5">
            {authUser?.phone && <><span className="font-semibold">Ph:</span> {authUser.phone}</>}
            {authUser?.email && <span className="ml-3"><span className="font-semibold">Email:</span> {authUser.email}</span>}
          </p>
          {authUser?.gstNo && <p className="text-sm text-slate-600 mt-0.5"><span className="font-semibold">GSTIN:</span> {authUser.gstNo}</p>}
        </div>
      </div>
      <div className="text-right flex flex-col justify-end h-full">
         <div className="text-xl font-bold text-slate-300 uppercase tracking-widest">{documentLabel}</div>
      </div>
    </div>
  );
}

export function InvoiceTerms({ compact }: { compact?: boolean }) {
  return (
    <div className={`text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      <p className="font-bold text-slate-700 mb-1">Terms & Conditions:</p>
      <ol className="list-decimal pl-4 space-y-0.5">
        <li>Goods once sold will not be taken back or exchanged.</li>
        <li>Subject to local jurisdiction.</li>
        <li>Ensure to bring this invoice for any future disputes or exchanges.</li>
      </ol>
    </div>
  );
}