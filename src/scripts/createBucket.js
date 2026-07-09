import { supabaseAdmin } from '../config/db.js';

async function createBucket(name) {
    console.log(`Intentando crear el bucket '${name}'...`);
    const { data, error } = await supabaseAdmin
        .storage
        .createBucket(name, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
            fileSizeLimit: 5242880 // 5MB
        });

    if (error) {
        if (error.message.includes('todo listo existe como bucket') || error.message.includes('already exists') || error.message.includes('The resource already exists')) {
            console.log(`Bucket '${name}' ya existe.`);
        } else {
            console.error(`Error al crear el bucket '${name}':`, error);
        }
    } else {
        console.log(`Bucket '${name}' creado exitosamente.`);
    }
}

async function main() {
    await createBucket('portadas');
    await createBucket('avatars');
}

main();
