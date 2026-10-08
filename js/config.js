// Configuración de Supabase.
// La "publishable key" (anon) está pensada para usarse en el navegador:
// la seguridad real la dan las políticas RLS definidas en supabase/schema.sql.
// Nunca pongas aquí la "secret key" / service_role.
//
// Si SUPABASE_URL queda vacío, la página funciona en "modo local": sin login y
// guardando todo solo en este navegador (sirve para probarla antes de configurar).
window.APP_CONFIG = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    // Cuenta única del equipo (creada en Supabase → Authentication → Users).
    // Con esto la pantalla de login solo pide la contraseña.
    // Déjalo en '' para pedir correo y contraseña (usuarios individuales).
    TEAM_EMAIL: 'equipo@rally-udla.com',
    TABLE: 'rally_items',
    SYNC_INTERVAL_MS: 3000
};
