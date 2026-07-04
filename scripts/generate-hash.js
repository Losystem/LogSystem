import bcrypt from 'bcrypt';

const password = 'Admin@1234';
const rounds = 12;

const hash = bcrypt.hashSync(password, rounds);
console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nCopy this hash to reset_platform.sql line 21 and 22');
