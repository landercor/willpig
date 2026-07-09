import { supabaseAdmin } from '../src/config/db.js';

async function createBucket() {
    console.log("Intentando crear el bucket 'portadas'...");
    const { data, error } = await supabaseAdmin
        .storage
        .createBucket('portadas', {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'],
            fileSizeLimit: 5242880 // 5MB
        });

    if (error) {
        if (error.message.includes('todo listo existe como bucket') || error.message.includes('already exists')) {
            console.log("Bucket 'portadas' ya existe.");
        } else {
            console.error("Error al crear el bucket 'portadas':", error);
        }
    } else {
        console.log("Bucket 'portadas' creado exitosamente.");
    }
}

createBucket();
