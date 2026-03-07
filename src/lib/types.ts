export type Bot = {
  id: string;
  public_bot_id: string;
  company_name: string;
  niche: string | null;
  system_prompt: string;
  model: string;
  temperature: number;
  max_completion_tokens: number;
  allowed_domain: string;
  handoff_email: string | null;
  monthly_token_limit: number;
  monthly_cost_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
