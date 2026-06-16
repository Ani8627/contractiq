-- Benchmark library seed data
-- ~30 market-standard clauses across all clause types.
-- Embeddings are initially NULL and backfilled by: npx tsx scripts/embed-library.ts

-- TERMINATION
insert into clause_library (clause_type, title, standard_text, guidance, severity_hint) values
(
  'termination',
  'Termination for convenience with 30-day notice',
  'Either party may terminate this Agreement for any reason upon thirty (30) days prior written notice to the other party. Upon termination, Customer shall pay for all services rendered up to the termination date, and any prepaid fees shall be refunded on a pro-rated basis.',
  'Market standard: 30-day notice, pro-rated refund of prepaid fees, mutual right. Red lines: (1) unilateral termination without notice by vendor, (2) no-refund clause on prepaid annual fees, (3) immediate termination for trivial breach without cure period. Fallback ask: require a 30-day cure period before termination takes effect for any breach.',
  'medium'
),
(
  'termination',
  'Termination for cause with cure period',
  'Either party may terminate this Agreement upon written notice if the other party materially breaches this Agreement and fails to cure such breach within thirty (30) days after receiving written notice of the breach. Termination for cause does not limit any other remedies available to the non-breaching party.',
  'Market standard: 30-day cure period is the norm; 10 days is too short for any non-security breach. Watch for clauses that allow immediate termination for minor technical breaches or that list cure-ineligible breaches so broadly they eliminate the cure right entirely. The cure period should apply to both parties equally.',
  'medium'
),
(
  'termination',
  'Data deletion upon termination',
  'Upon termination or expiration of this Agreement, Vendor shall, at Customer''s election, return or securely delete all Customer Data within thirty (30) days, and provide written certification of deletion upon request.',
  'Market standard: 30-day return/delete window with written certification. Red lines: (1) vendor claims a license to retain customer data post-termination, (2) no deletion obligation, (3) deletion window exceeds 60 days. Ensure the clause covers backups explicitly.',
  'high'
);

-- LIABILITY
insert into clause_library (clause_type, title, standard_text, guidance, severity_hint) values
(
  'liability',
  'Mutual liability cap at 12 months fees',
  'EACH PARTY''S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT, WHETHER IN CONTRACT, TORT, OR UNDER ANY OTHER THEORY OF LIABILITY, SHALL NOT EXCEED THE TOTAL FEES PAID OR PAYABLE BY CUSTOMER TO VENDOR IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.',
  'Market standard: mutual cap at 12 months'' fees. Red lines: (1) one-sided cap that only limits the vendor, (2) cap is a fraction of fees paid (e.g., 3 months), (3) no carve-outs for death/personal injury or fraud. Standard carve-outs that should INCREASE the cap or be uncapped: IP infringement, willful misconduct, gross negligence, data breaches, confidentiality breaches.',
  'high'
),
(
  'liability',
  'Mutual exclusion of consequential damages',
  'IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS OR LOSS OF DATA, REGARDLESS OF THE THEORY OF LIABILITY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.',
  'Market standard: mutual exclusion of consequential damages. Red line: one-sided waiver where only the customer (not vendor) waives consequential damages. Carve-outs that should survive: breach of confidentiality, IP infringement indemnity obligations, and gross negligence/wilful misconduct. Ask: "Is this mutual?" If not, make it mutual or delete.',
  'medium'
),
(
  'liability',
  'Uncapped liability for data breaches',
  'Notwithstanding the liability limitations set forth herein, the limitations shall not apply to (i) either party''s indemnification obligations, (ii) breaches of confidentiality, (iii) infringement of the other party''s intellectual property rights, or (iv) death or personal injury caused by negligence.',
  'Market standard carve-outs from the liability cap. These are the items that should always survive a cap. If a vendor refuses to carve out data breaches and confidentiality breaches, that is a critical flag — it means the cap applies even if they leak all your data. Non-negotiable for enterprise contracts.',
  'critical'
);

-- PAYMENT
insert into clause_library (clause_type, title, standard_text, guidance, severity_hint) values
(
  'payment',
  'Net-30 payment terms with reasonable late fees',
  'Customer shall pay all undisputed invoices within thirty (30) days of the invoice date. Past-due amounts will accrue interest at the lower of 1.5% per month or the maximum rate permitted by law. Vendor shall provide written notice of non-payment before suspending services.',
  'Market standard: Net-30, late interest ≤ 1.5%/month (18%/year). Red lines: (1) Net-15 or less, (2) interest rate above 1.5%/month, (3) "fees are non-refundable under all circumstances" — this removes your leverage if services are not delivered, (4) automatic renewal without notice. Ask for a 15-day grace period and notice before service suspension.',
  'low'
),
(
  'payment',
  'Price increase notice requirement',
  'Vendor may increase fees for any renewal term upon at least sixty (60) days prior written notice to Customer before the start of such renewal term. Any increase in excess of 5% above the CPI increase shall require Customer''s written consent.',
  'Market standard: 60-day notice of price increases, with a cap tied to CPI. Red lines: (1) no notice required, (2) any price increase requires no consent, (3) vendor can change fees mid-term. For SaaS, reasonable to ask for a 90-day notice and a 3–5% annual cap on increases.',
  'medium'
);

-- IP
insert into clause_library (clause_type, title, standard_text, guidance, severity_hint) values
(
  'ip',
  'Customer owns all deliverables, vendor retains pre-existing IP',
  'All work product, deliverables, inventions, and materials developed by Vendor specifically for Customer under this Agreement ("Deliverables") are works made for hire and all IP rights therein vest in Customer upon creation. Vendor retains ownership of all pre-existing IP, tools, methodologies, and general know-how ("Vendor IP"). Vendor grants Customer a perpetual, royalty-free license to use Vendor IP embedded in the Deliverables.',
  'Market standard for custom development contracts. Red lines: (1) vendor claims ownership of customer-specific deliverables, (2) no license-back for embedded vendor IP (means you can''t use the deliverable), (3) vague definition of "pre-existing IP" that could swallow custom work. Ensure Deliverables are defined in a schedule. For SaaS, vendor typically retains platform IP and grants a license instead.',
  'high'
),
(
  'ip',
  'SaaS license grant to customer',
  'Subject to the terms of this Agreement and payment of fees, Vendor grants Customer a limited, non-exclusive, non-transferable, non-sublicensable license to access and use the Service solely for Customer''s internal business purposes during the Subscription Term.',
  'Market standard SaaS license: limited, non-exclusive, internal use only. Check: (1) scope — "internal business purposes" is standard; broader language is a flag, (2) restrictions section should not prohibit benchmarking or competitive analysis, (3) ensure the license covers affiliates/subsidiaries if needed, (4) confirm the license survives payment disputes during a good-faith dispute resolution period.',
  'low'
),
(
  'ip',
  'No use of customer data to train AI models',
  'Vendor shall not use Customer Data to train, fine-tune, or improve any machine learning or artificial intelligence models, including large language models, without Customer''s prior written consent. This restriction survives termination of the Agreement.',
  'Critical for any vendor that uses AI infrastructure. AI training on your data creates permanent IP and privacy risks. Red line: any clause permitting AI training on customer data without explicit opt-in consent. Ask for a "no-training" rider. This is non-negotiable for contracts involving personal data, trade secrets, or regulated information.',
  'critical'
);

-- NDA
insert into clause_library (clause_type, title, standard_text, guidance, severity_hint) values
(
  'nda',
  'Mutual confidentiality with 3-year term and standard exclusions',
  'Each party agrees to hold the other party''s Confidential Information in strict confidence and not to disclose it to any third party without prior written consent. Obligations of confidentiality shall survive for three (3) years following disclosure. "Confidential Information" excludes information that: (i) is or becomes publicly known through no fault of the receiving party; (ii) was independently developed without use of the Confidential Information; or (iii) is required to be disclosed by law or court order, provided the disclosing party is given prompt notice.',
  'Market standard: mutual, 3-year term (perpetual for trade secrets), the four standard exclusions. Red lines: (1) one-way confidentiality (you are bound, they are not), (2) perpetual term for all information (overly burdensome operationally), (3) no carve-out for legally required disclosure, (4) definition of "Confidential Information" is so broad it captures public information. Ensure the residuals clause (allows employees to use general knowledge retained in memory) is mutual if present.',
  'medium'
),
(
  'nda',
  'Residuals clause — acceptable form',
  'Notwithstanding the above, either party''s personnel may use Residual Knowledge (general ideas, concepts, know-how, or techniques retained in unaided memory) without restriction, provided that no Confidential Information is deliberately memorized for use, and the residuals right does not apply to trade secrets.',
  'Residuals clauses are common in vendor contracts. The acceptable form limits residuals to (1) unaided memory only, (2) excludes trade secrets, and (3) prohibits deliberate memorization. Red line: a broad residuals clause with no trade-secret carve-out, no "unaided memory" requirement, or that effectively allows the vendor to replicate your product based on exposure to your IP.',
  'medium'
);

-- INDEMNIFICATION
insert into clause_library (clause_type, title, standard_text, guidance, severity_hint) values
(
  'indemnification',
  'Mutual indemnification for third-party IP claims',
  'Each party ("Indemnifying Party") shall defend, indemnify, and hold harmless the other party ("Indemnified Party") from and against any third-party claims alleging that the Indemnifying Party''s materials infringe or misappropriate any third-party intellectual property rights, and shall pay any damages and costs awarded by a court or agreed in settlement, provided that the Indemnified Party: (i) promptly notifies the Indemnifying Party in writing; (ii) gives the Indemnifying Party sole control of the defense; and (iii) provides reasonable cooperation.',
  'Market standard: mutual IP indemnification. Red lines: (1) one-way indemnity where only the customer indemnifies the vendor — this means you absorb all IP risk from using their service, (2) no indemnity obligation on the vendor for their own IP infringement, (3) indemnity obligation on customer for "use in combination with third-party products" that is so broad it eliminates vendor''s IP warranty. Ensure vendor indemnifies you for IP in the service itself.',
  'high'
),
(
  'indemnification',
  'Vendor data breach indemnification',
  'Vendor shall indemnify, defend, and hold harmless Customer from and against any third-party claims, regulatory fines, and penalties arising from Vendor''s failure to comply with applicable data protection laws or from a security breach of Vendor''s systems affecting Customer Data.',
  'Market standard: vendor should own the indemnification risk for their own data breaches. Red lines: (1) no data breach indemnity by vendor, (2) cap on data breach indemnity is the same as the general cap (should be higher), (3) vendor requires customer to waive GDPR/CCPA statutory rights. For any contract involving personal data, this clause is non-negotiable.',
  'critical'
);

-- GOVERNING LAW
insert into clause_library (clause_type, title, standard_text, guidance, severity_hint) values
(
  'governing_law',
  'Neutral governing law with defendant-venue arbitration',
  'This Agreement shall be governed by the laws of [State/Country], without regard to conflict of law principles. Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in the city of the responding party''s principal place of business, under the rules of [AAA/JAMS/ICC]. The prevailing party shall be entitled to recover reasonable attorneys'' fees.',
  'Market standard: neutral state law, defendant-venue arbitration (means you litigate close to home if you''re defending), fees-to-prevailing-party is a double-edged sword that discourages nuisance suits. Red lines: (1) mandatory arbitration in vendor''s home city only (forces you to arbitrate 3,000 miles away), (2) class action waiver that eliminates your ability to join a class, (3) fee-shifting clause where only the customer pays fees if they lose, (4) very short limitation period (less than 1 year for contractual claims).',
  'medium'
),
(
  'governing_law',
  'High-risk arbitration stack (what to watch for)',
  'Any dispute must be resolved through binding individual arbitration administered by [Arbitrator] in [Vendor City]. Customer waives the right to participate in any class action. The arbitrator''s decision shall be final and binding. Customer shall pay all arbitration filing fees.',
  'HIGH RISK: This is a one-sided arbitration stack. (1) mandatory arbitration eliminates your right to a jury trial, (2) vendor''s home city forces you to travel at your expense, (3) class action waiver eliminates collective remedies for small but widespread harms, (4) customer pays filing fees is unusual and punitive. Counter: delete mandatory arbitration, or require neutral venue (e.g., AAA remote arbitration), mutual class waiver, and equal fee sharing.',
  'critical'
);
