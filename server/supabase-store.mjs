const MATH_KEYS = Object.freeze({
  progress: 'math_student_progress_v1'
});

export class SupabaseMathStore {
  constructor({ url, serviceRoleKey, table, progressRpc, displayStatusRpc = 'math_set_display_status_v1' }) {
    this.url = String(url || '').replace(/\/+$/, '');
    this.serviceRoleKey = String(serviceRoleKey || '');
    this.table = String(table || '');
    this.progressRpc = String(progressRpc || '');
    this.displayStatusRpc = String(displayStatusRpc || '');
    if (!this.url || !this.serviceRoleKey || !/^math_[a-z0-9_]+$/.test(this.table) || !/^math_[a-z0-9_]+$/.test(this.progressRpc) || !/^math_[a-z0-9_]+$/.test(this.displayStatusRpc)) {
      throw new Error('Supabase math server configuration is incomplete');
    }
  }

  headers(extra = {}) {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...extra
    };
  }

  async read(key) {
    if (!Object.values(MATH_KEYS).includes(key)) throw new Error('Unknown math storage key');
    const endpoint = `${this.url}/rest/v1/${this.table}?key=eq.${encodeURIComponent(key)}&select=value`;
    const response = await fetch(endpoint, { headers: this.headers(), cache: 'no-store' });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Supabase math read failed (${response.status})`);
    if (!Array.isArray(body) || body.length !== 1 || !body[0]?.value) throw new Error(`Supabase math key is missing: ${key}`);
    return body[0].value;
  }

  progress() {
    return this.read(MATH_KEYS.progress);
  }

  async saveTeachingStatus({ studentId, knowledgeId, teachingStatus }) {
    const endpoint = `${this.url}/rest/v1/rpc/${this.progressRpc}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        p_student_id: studentId,
        p_knowledge_id: knowledgeId,
        p_teaching_status: teachingStatus
      })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== 'object') throw new Error(`Supabase math progress RPC failed (${response.status})`);
    return body;
  }

  async saveDisplayStatus({ studentId, knowledgeId, displayStatus }) {
    const endpoint = `${this.url}/rest/v1/rpc/${this.displayStatusRpc}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ p_student_id: studentId, p_knowledge_id: knowledgeId, p_display_status: displayStatus })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== 'object') throw new Error(`Supabase math display-status RPC failed (${response.status})`);
    return body;
  }
}

export { MATH_KEYS };
