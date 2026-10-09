import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const db = url && key ? createClient(url, key) : null;
export const money = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(Number(value || 0));
export const date = value => value ? new Intl.DateTimeFormat('pt-BR', {dateStyle:'medium', ...(value.includes('T') ? {timeStyle:'short',timeZone:'America/Sao_Paulo'} : {})}).format(new Date(value.includes('T') ? value : value+'T12:00:00')) : 'A definir';
export const isStaff = user => ['admin','team'].includes(user?.app_metadata?.office_role);
export function safeUrl(value) { try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
export function amount(value) { const n = Number(String(value).replace(',','.')); if (!Number.isFinite(n) || n < 0) throw new Error('Informe um valor válido.'); return n; }
export const emptyData = {profiles:[],cases:[],events:[],payments:[],documents:[],articles:[]};
export const defaultSettings = {name:'Muzzi & Almeida',intro:'Advocacia com atenção a cada detalhe.',about:'Um espaço para conhecer o escritório e acompanhar seu atendimento com clareza e proximidade.',areas:[],address:'',phone:'',email:'',whatsapp:'',map_url:''};
