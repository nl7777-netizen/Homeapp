import { Modal } from '../ui';

/** Educational reference for the CGT rules the engine implements. */
export function CgtRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Australian CGT Rules (as implemented)" onClose={onClose} wide>
      <div className="space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <section>
          <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">1. Principal place of residence (PPOR) exemption</h4>
          <p>
            A property that has always been your PPOR is <strong>100% CGT-exempt</strong> on sale (s.118-145 ITAA 1997).
            This is Scenario A/C with the "PPOR — always lived in" treatment.
          </p>
        </section>
        <section>
          <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">2. The 6-year absence rule (s.118-145(3))</h4>
          <p>
            If you lived in the property at some point and it is rented out, the CGT exemption continues for up to{' '}
            <strong>72 months (6 years)</strong> of rental. Rented ≤ 72 months → still 0% CGT. Rented &gt; 72 months → the
            exemption is cut off and only the gain <strong>after the exemption period ends</strong> is taxed.
          </p>
        </section>
        <section>
          <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">3. The s.118-192 value reset</h4>
          <p>
            When the 6-year rule is exceeded, the cost base is reset to the <strong>market value at the start of the rental</strong>{' '}
            (your "value at first rental" input). Only the appreciation from that reset value to sale is assessable — the
            pre-rental gain stays exempt. Example: bought at $500k, first rented at $700k, sold at $800k after 84 months →
            only $100k of gain is taxed.
          </p>
        </section>
        <section>
          <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">4. Investment properties</h4>
          <p>
            Full CGT applies: gain = sale price − (purchase price + purchase costs), taxed at your marginal rate.
            <strong> 50% CGT discount</strong> applies if you held the asset for more than 12 months (individuals/families).
            CGT is taxed at the ownership-weighted marginal rate of the partners.
          </p>
        </section>
        <section>
          <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">5. Post-1 July 2027 reform mode</h4>
          <p>
            The Treasurer's announced reforms (from 1 Jul 2027): the 50% discount is <strong>removed for most assets</strong>,{' '}
            the cost base is <strong>CPI-indexed</strong> for each year after 1 Jul 2027, and a <strong>30% minimum CGT rate</strong>{' '}
            floor applies (whichever is higher, your marginal rate or 30%). Toggle "Post-1-Jul-2027 reform" to model it.
          </p>
        </section>
        <section>
          <h4 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">6. Negative gearing &amp; the 2027 loss-quarantine</h4>
          <p>
            Rental losses (interest + expenses − rent − depreciation) offset other income at your marginal rate while{' '}
            <strong>grandfathered</strong>. Under the announced reform, losses on properties acquired after 1 Jul 2027 are{' '}
            <strong>quarantined</strong> against non-rental income — the engine stops the refund from the month of the
            reform for non-grandfathered properties.
          </p>
        </section>
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Simplified for planning purposes — individual facts (trusts, companies, prior CGT losses, temporary absence
          rules) change outcomes. Confirm with a registered tax agent before acting.
        </p>
      </div>
    </Modal>
  );
}
