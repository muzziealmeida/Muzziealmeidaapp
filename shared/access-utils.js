export function normalizeUsername(value) {
 const username=String(value||'').trim().replace(/^@/,'').toLowerCase();
 if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))throw new Error('Use um usuário de 3 a 40 caracteres, com letras, números, ponto, hífen ou sublinhado.');
 return username;
}
export const loginEmail=username=>`${normalizeUsername(username)}@access.muzziealmeida.app`;
export function newPassword(value,initial){
 if(typeof value!=='string'||value.length<10||value.length>128)throw new Error('A nova senha deve ter entre 10 e 128 caracteres.');
 if(value===initial)throw new Error('Escolha uma senha diferente da senha provisória.');
 return value;
}
