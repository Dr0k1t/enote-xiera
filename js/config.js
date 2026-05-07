export const CONFIG = {
  clientName:     'Xiera',
  clientSubtitle: 'Ocotlán, Jalisco',
  appName:        'Enote',
  storagePrefix:  'enote_',

  locations: ['Sucursal', 'Planta de Producción'],
  defaultDestino: 'Planta de Producción',

  statuses: ['Nueva', 'En Proceso', 'Completada', 'Cancelada'],

  confirmEditStatuses: ['En Proceso', 'Completada'],

  users: [
    { username: 'admin1',  password: 'pass', role: 'admin',  destino: null },
    { username: 'planta1', password: 'pass', role: 'planta', destino: 'Planta de Producción' },
  ],

  roles: {
    admin:  { canCreate: true,  canEdit: true,  canDelete: true,  canSeeAll: true  },
    planta: { canCreate: false, canEdit: false,  canDelete: false, canSeeAll: false },
  },

  noteNumberFormat: (id) => `#${String(id).padStart(4, '0')}`,

  googleFontsUrl:
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap',
};
