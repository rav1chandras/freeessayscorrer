import type { Metadata } from 'next'
import Link from 'next/link'
import { FeatherSparkleLogo, ChevronLeft } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Privacy Policy — Free Essay Scorer',
  description: 'How Free Essay Scorer handles your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-admitly-cream">
      <header className="h-14 border-b border-admitly-black/6 bg-white flex items-center px-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <ChevronLeft size={18} className="text-admitly-black/40 group-hover:text-admitly-black transition-colors" />
          <FeatherSparkleLogo size={30} />
          <span className="font-display font-extrabold text-[18px] leading-none text-admitly-black tracking-[-0.025em]">
            Free Essay Scorer<span className="text-fes-blue">.</span>
          </span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <p className="text-xs font-black tracking-[0.18em] text-fes-blue uppercase mb-3">Legal</p>
        <h1 className="font-display text-3xl sm:text-5xl font-black tracking-[-0.035em] text-admitly-black leading-[1] mb-3">
          Privacy Policy<span className="text-fes-blue">.</span>
        </h1>
        <p className="text-sm text-admitly-black/50 mb-10">Last updated: April 2026</p>

        <div className="prose-content space-y-8 text-sm sm:text-[15px] text-admitly-black/80 leading-relaxed">

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">Overview</h2>
            <p>This Privacy Policy describes how Free Essay Scorer (&ldquo;FES,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) collects, uses, and shares information in connection with the FES website and tools (the &ldquo;Service&rdquo;). By using the Service, you consent to the practices described here. If you do not agree, do not use the Service.</p>
            <p className="mt-3">Our collection and use of personal information is also subject to our <Link href="/terms" className="text-fes-blue underline font-semibold">Terms of Service</Link>. Any capitalized term not defined here has the meaning given in the Terms.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">1. Information you provide</h2>
            <p>We collect two categories of information directly from you:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><span className="font-bold">Essay content.</span> Text you paste into the Service in order to receive feedback. This is processed as described in section 2 and is not retained by us after the request completes.</li>
              <li><span className="font-bold">Email addresses.</span> If you voluntarily submit an email address (for example, to request free Admitly credits, to unlock a premium tool, or to save an analysis), we collect the address along with the tool or surface that prompted the submission and the timestamp of submission. Disposable-email addresses from commonly known throwaway providers are automatically rejected.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">2. How essay content is processed</h2>
            <p>When you submit an essay, the text is transmitted to <span className="font-bold text-admitly-black">OpenAI&apos;s API</span> so that an AI model can generate the feedback you see. This transmission happens in real time during the request. OpenAI is an independent third party and processes your content under its own privacy practices and data policies, currently available at <a href="https://openai.com/policies" target="_blank" rel="noopener noreferrer" className="text-fes-blue underline font-semibold">openai.com/policies</a>. We have no control over OpenAI&apos;s practices and make no representations about them.</p>
            <p className="mt-3">FES does not persistently store the essay text you submit on our own infrastructure. It exists only in your browser, in the outgoing API request, and in OpenAI&apos;s returned response. Because the request is processed by a third party, however, we cannot guarantee that your content is not retained, reviewed, or otherwise processed by that third party in accordance with their own policies.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">3. Information we collect automatically</h2>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><span className="font-bold">Usage events.</span> Anonymous events describing how the Service is used, including which tool you clicked, whether a request succeeded or failed, the qualitative tier of the result (e.g. &ldquo;great,&rdquo; &ldquo;okay,&rdquo; &ldquo;needs-work&rdquo;), and whether you clicked outbound links. These events do not include essay content or identifying personal data.</li>
              <li><span className="font-bold">Technical data.</span> Your IP address, user-agent string, and request timestamps as captured by our servers in the ordinary course of operation.</li>
              <li><span className="font-bold">Session cookie.</span> A single HTTP-only cookie named <code className="bg-admitly-black/5 px-1.5 py-0.5 rounded text-xs font-mono">fes_session</code> containing a random session identifier, used solely to enforce the daily per-browser quota. The cookie does not contain your essay, email, or any identifying information.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">4. How we use information</h2>
            <p>We use the information described above to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Operate, maintain, and improve the Service.</li>
              <li>Enforce the per-browser daily quota and other technical limits.</li>
              <li>Detect, prevent, and investigate fraud, abuse, and security incidents.</li>
              <li>Respond to the specific request you made (e.g. send you the credits you asked for).</li>
              <li>Send you service-related messages about updates, new features, and related offerings from Admitly.</li>
              <li>Comply with applicable legal obligations and enforce our Terms.</li>
              <li>Aggregate and analyze usage patterns to guide product decisions.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">5. Legal bases for processing (EU/UK users)</h2>
            <p>If you are located in the European Economic Area, the United Kingdom, or a similar jurisdiction, we rely on the following legal bases:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><span className="font-bold">Consent</span> for email submissions and marketing communications. You may withdraw consent at any time.</li>
              <li><span className="font-bold">Performance of a contract</span> for essay processing and delivery of requested features.</li>
              <li><span className="font-bold">Legitimate interests</span> for anonymous analytics, fraud prevention, quota enforcement, and service improvement, in each case balanced against your rights.</li>
              <li><span className="font-bold">Compliance with a legal obligation</span> where processing is required by applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">6. Sharing of information</h2>
            <p>We share information only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><span className="font-bold">Service providers.</span> With third-party vendors who perform services on our behalf, including OpenAI (AI processing) and the hosting provider. These vendors are bound by their own terms and privacy practices.</li>
              <li><span className="font-bold">Admitly.</span> Email addresses you voluntarily submit through FES may be shared with Admitly, a separate affiliated service, so that Admitly can deliver the credits or follow-up communications you requested. Admitly&apos;s own privacy policy governs any further use of your email.</li>
              <li><span className="font-bold">Legal and safety.</span> To comply with applicable law, legal process, or enforceable governmental request; to enforce our Terms; to detect, prevent, or address fraud, security, or technical issues; or to protect the rights, property, or safety of FES, our users, or others.</li>
              <li><span className="font-bold">Business transfers.</span> In connection with a merger, acquisition, reorganization, bankruptcy, or sale of all or a portion of our assets, in which case information may be transferred to the successor entity as part of that transaction.</li>
            </ul>
            <p className="mt-3"><span className="font-bold text-admitly-black">We do not sell your personal information</span> as that term is commonly understood, and we do not share personal information with third-party advertisers for their own targeted-advertising purposes.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">7. Data retention</h2>
            <p>We retain information only as long as needed for the purposes described in this policy or as required by law:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><span className="font-bold">Essay content:</span> not retained after the request completes.</li>
              <li><span className="font-bold">Usage events:</span> retained for up to 24 months for product analytics, then deleted or aggregated into non-identifying form.</li>
              <li><span className="font-bold">Email submissions:</span> retained until you request deletion or until deemed inactive for our purposes.</li>
              <li><span className="font-bold">Session cookie:</span> expires 30 days after it is set.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">8. International data transfers</h2>
            <p>The Service is operated from the United States. If you access it from outside the United States, your information will be transferred to, processed in, and stored in the United States. Our AI processing vendor (OpenAI) is also a United States entity. By using the Service, you consent to this transfer and processing in the United States, which may have data-protection laws different from those of your country.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">9. Security</h2>
            <p>We use commercially reasonable administrative, technical, and physical safeguards to protect the information we hold. However, no system is completely secure. We cannot guarantee the security of information transmitted over the internet or stored on our systems, and we disclaim liability for unauthorized access to the maximum extent permitted by law.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">10. Children&apos;s privacy</h2>
            <p>The Service is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. Many of our users are minors in high school; if you are under 18, please review this policy with a parent or legal guardian before using the Service. If we learn that we have collected personal information from a child under 13 without verified parental consent, we will delete it.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">11. Your rights</h2>
            <p>Depending on where you live, you may have certain rights regarding your personal information, including the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Request access to the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your information (subject to legal retention obligations).</li>
              <li>Object to or restrict certain processing.</li>
              <li>Request data portability in a structured, commonly used format.</li>
              <li>Withdraw consent where we rely on consent as the legal basis.</li>
              <li>Lodge a complaint with a supervisory authority in your jurisdiction.</li>
            </ul>
            <p className="mt-3">California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know, the right to delete, and the right to non-discrimination. To exercise any of these rights, contact us using the address in section 14. We will verify your identity before fulfilling a request and may decline requests that are manifestly unfounded or excessive.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">12. Do Not Track and opt-out signals</h2>
            <p>Our Service does not currently respond to &ldquo;Do Not Track&rdquo; signals or similar mechanisms, because there is no industry consensus on how to interpret them. We do not sell personal information, so opt-out-of-sale signals have no additional effect on our practices.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">13. Changes to this policy</h2>
            <p>We may update this Privacy Policy from time to time in our sole discretion. Material changes will be reflected in the &ldquo;Last updated&rdquo; date at the top. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy. We are not obligated to notify you individually of updates.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-black text-admitly-black mb-2 tracking-tight">14. Contact</h2>
            <p>Privacy-related requests, questions, or complaints should be directed to <span className="font-bold text-admitly-black">support (at) freeessayscorer.com</span>.</p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-admitly-black/10 flex items-center justify-between text-xs text-admitly-black/50">
          <Link href="/terms" className="font-semibold hover:text-admitly-black transition-colors">← Terms of Service</Link>
          <Link href="/" className="font-semibold hover:text-admitly-black transition-colors">Back to Free Essay Scorer →</Link>
        </div>
      </main>
    </div>
  )
}
