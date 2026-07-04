import bcrypt from 'bcryptjs';

const password = 'admin';
const rounds = 10;

const hash = bcrypt.hashSync(password, rounds);
console.log('Password:', password);
console.log('Hash (bcryptjs):', hash);
console.log('\nCopy this hash to the migration');
