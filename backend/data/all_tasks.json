[
  {
    "node_id": "prospect_research",
    "label": "Prospect Research",
    "description": "Find and evaluate potential leads using LinkedIn and CRM, assess fit against ICP criteria",
    "action_verb": "research",
    "inputs": ["icp_criteria", "linkedin", "crm_database"],
    "outputs": ["qualified_prospect_record"],
    "app_cluster": ["linkedin", "salesforce"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 35, "std_minutes": 12},
    "automatable_fraction": "high"
  },
  {
    "node_id": "draft_outreach",
    "label": "Draft Outreach Message",
    "description": "Write personalized cold email or LinkedIn message based on prospect research",
    "action_verb": "produce",
    "inputs": ["prospect_record", "message_templates"],
    "outputs": ["drafted_message"],
    "app_cluster": ["gmail", "notion"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 24, "std_minutes": 9},
    "automatable_fraction": "high"
  },
  {
    "node_id": "send_and_log",
    "label": "Send Message and Log Activity",
    "description": "Send drafted outreach and record activity in CRM",
    "action_verb": "log",
    "inputs": ["drafted_message", "crm_contact"],
    "outputs": ["sent_message", "crm_activity_log"],
    "app_cluster": ["gmail", "salesforce"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 8, "std_minutes": 3},
    "automatable_fraction": "medium"
  },
  {
    "node_id": "follow_up_sequence",
    "label": "Follow-Up Sequence Management",
    "description": "Execute multi-touch follow-up cadence across email and LinkedIn over 7-14 days. Adjust messaging based on opens/clicks. Decide when to pause or kill the thread.",
    "action_verb": "sequence",
    "inputs": ["sent_message", "engagement_signals", "cadence_template"],
    "outputs": ["follow_up_messages", "sequence_status", "crm_activity_log"],
    "app_cluster": ["outreach", "gmail", "salesforce", "linkedin"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 18, "std_minutes": 7},
    "automatable_fraction": "high"
  },
  {
    "node_id": "response_triage",
    "label": "Inbound Response Triage",
    "description": "Classify prospect reply as hot/warm/cold/unsubscribe. Draft and send immediate reply to hot leads. Route objections. Update CRM stage and flag for manager if high-value.",
    "action_verb": "classify",
    "inputs": ["prospect_reply", "crm_contact", "triage_rubric"],
    "outputs": ["reply_classification", "response_draft", "crm_stage_update"],
    "app_cluster": ["gmail", "salesforce", "slack"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 14, "std_minutes": 6},
    "automatable_fraction": "medium"
  },
  {
    "node_id": "discovery_call_prep",
    "label": "Discovery Call Preparation",
    "description": "Research prospect company (funding, headcount, tech stack, recent news). Build a call agenda. Prepare MEDDIC qualification questions. Review any prior touchpoints in CRM.",
    "action_verb": "prepare",
    "inputs": ["crm_contact", "company_news", "call_agenda_template", "meddic_framework"],
    "outputs": ["call_brief", "question_list", "agenda_doc"],
    "app_cluster": ["salesforce", "notion", "linkedin", "crunchbase", "google"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 42, "std_minutes": 15},
    "automatable_fraction": "high"
  },
  {
    "node_id": "discovery_call_execution",
    "label": "Discovery Call Execution",
    "description": "Run 30-45 min discovery call. Uncover pain points, budget, timeline, and decision-making process. Qualify or disqualify opportunity. Schedule follow-up if qualified.",
    "action_verb": "converse",
    "inputs": ["call_brief", "agenda_doc", "prospect_contact"],
    "outputs": ["call_recording", "live_notes", "qualification_verdict", "next_step_booked"],
    "app_cluster": ["zoom", "gong", "calendly", "salesforce"],
    "duration_distribution": {"type": "normal", "mean_minutes": 38, "std_minutes": 10},
    "automatable_fraction": "low"
  },
  {
    "node_id": "call_debrief_logging",
    "label": "Post-Call Debrief and CRM Logging",
    "description": "Review Gong transcript. Write structured call summary. Update MEDDIC fields in Salesforce. Log outcome, next steps, and follow-up tasks. Share notes with AE or manager if tag-team deal.",
    "action_verb": "log",
    "inputs": ["call_recording", "live_notes", "meddic_template", "crm_opportunity"],
    "outputs": ["call_summary", "updated_crm_opportunity", "follow_up_tasks"],
    "app_cluster": ["gong", "salesforce", "notion", "slack"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 22, "std_minutes": 8},
    "automatable_fraction": "high"
  },
  {
    "node_id": "stakeholder_mapping",
    "label": "Stakeholder and Buying Committee Mapping",
    "description": "Identify all decision-makers, influencers, and blockers at the prospect account. Map org chart using LinkedIn and intel from discovery call. Determine who controls budget vs. who signs.",
    "action_verb": "map",
    "inputs": ["discovery_call_notes", "linkedin", "crm_account", "org_chart_template"],
    "outputs": ["stakeholder_map", "champion_identified", "crm_contacts_updated"],
    "app_cluster": ["linkedin", "salesforce", "notion", "lucidchart"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 30, "std_minutes": 11},
    "automatable_fraction": "medium"
  },
  {
    "node_id": "demo_scheduling_and_prep",
    "label": "Demo Scheduling and Preparation",
    "description": "Coordinate demo logistics across multiple stakeholders. Customize demo flow based on the prospect's use case and pain points from discovery. Prep a sandbox environment if needed.",
    "action_verb": "prepare",
    "inputs": ["stakeholder_map", "discovery_notes", "demo_template", "product_sandbox"],
    "outputs": ["calendar_invite", "custom_demo_script", "demo_environment_ready"],
    "app_cluster": ["calendly", "zoom", "notion", "product_sandbox", "salesforce"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 50, "std_minutes": 18},
    "automatable_fraction": "medium"
  },
  {
    "node_id": "demo_delivery",
    "label": "Product Demo Delivery",
    "description": "Run a tailored product demo for prospect's buying committee. Walk through specific pain-point use cases. Handle live Q&A. Gauge room temperature and pivot if engagement drops.",
    "action_verb": "present",
    "inputs": ["custom_demo_script", "demo_environment_ready", "stakeholder_map"],
    "outputs": ["demo_recording", "live_feedback_notes", "interest_signals", "next_step_agreed"],
    "app_cluster": ["zoom", "gong", "notion", "product_sandbox"],
    "duration_distribution": {"type": "normal", "mean_minutes": 52, "std_minutes": 12},
    "automatable_fraction": "low"
  },
  {
    "node_id": "objection_handling",
    "label": "Objection Handling and Re-engagement",
    "description": "Respond to post-demo objections (price, timing, competitor, internal priority). Draft written responses or schedule a follow-up call. Pull relevant case studies or ROI data. Loop in SE or manager for technical or pricing objections.",
    "action_verb": "respond",
    "inputs": ["objection_log", "case_study_library", "competitor_battlecards", "roi_calculator"],
    "outputs": ["objection_response", "supporting_collateral", "crm_notes_updated"],
    "app_cluster": ["gmail", "notion", "salesforce", "slack", "google_drive"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 35, "std_minutes": 14},
    "automatable_fraction": "medium"
  },
  {
    "node_id": "proposal_drafting",
    "label": "Proposal and Quote Drafting",
    "description": "Build a tailored proposal including pricing tiers, scope of work, implementation timeline, and ROI projection. Align with manager on discount authority. Send for internal review before delivery.",
    "action_verb": "produce",
    "inputs": ["opportunity_record", "pricing_sheet", "sow_template", "roi_calculator", "manager_approval"],
    "outputs": ["proposal_doc", "quote_in_crm", "sent_proposal"],
    "app_cluster": ["google_docs", "salesforce_cpq", "notion", "gmail", "slack"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 65, "std_minutes": 22},
    "automatable_fraction": "high"
  },
  {
    "node_id": "contract_negotiation",
    "label": "Contract Negotiation and Legal Review",
    "description": "Manage redlines and counter-proposals on MSA and order form. Coordinate with legal if custom terms are requested. Track version history and maintain urgency to close before quarter-end.",
    "action_verb": "negotiate",
    "inputs": ["proposal_doc", "standard_msa", "legal_team", "prospect_redlines"],
    "outputs": ["agreed_contract", "docusign_envelope", "crm_close_date_updated"],
    "app_cluster": ["docusign", "gmail", "google_docs", "salesforce", "slack"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 90, "std_minutes": 45},
    "automatable_fraction": "low"
  },
  {
    "node_id": "deal_closure_and_handoff",
    "label": "Deal Closure and CS Handoff",
    "description": "Confirm signed contract received and payment terms set. Mark opportunity Closed-Won in CRM. Write internal handoff doc for Customer Success with context on stakeholders, use case, and commitments made during sale.",
    "action_verb": "handoff",
    "inputs": ["signed_contract", "crm_opportunity", "cs_handoff_template", "call_summaries"],
    "outputs": ["closed_won_opportunity", "cs_handoff_doc", "kickoff_call_scheduled"],
    "app_cluster": ["salesforce", "notion", "slack", "google_docs", "docusign"],
    "duration_distribution": {"type": "lognormal", "mean_minutes": 28, "std_minutes": 10},
    "automatable_fraction": "medium"
  }
]