// Versión de Enote — reescrita por scripts/build-config.js (env ENOTE_VERSION).
// Expuesta al runtime para el badge de versión (abajo-derecha).
export const ENOTE_VERSION = '1.7.0';

export const CONFIG = {
  clientName:     'Xiera',
  clientSubtitle: 'Ocotlán, Jalisco',
  appName:        'Enote',
  storagePrefix:  'enote_',

  locations: ['Ocotlán', 'Atequiza', 'Tototlán'],
  defaultDestino: '',

  statuses: ['Nueva', 'En Proceso', 'Completada', 'Cancelada'],

  MESES: [
    { value: '01', label: 'Enero'      },
    { value: '02', label: 'Febrero'    },
    { value: '03', label: 'Marzo'      },
    { value: '04', label: 'Abril'      },
    { value: '05', label: 'Mayo'       },
    { value: '06', label: 'Junio'      },
    { value: '07', label: 'Julio'      },
    { value: '08', label: 'Agosto'     },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre'    },
    { value: '11', label: 'Noviembre'  },
    { value: '12', label: 'Diciembre'  },
  ],

  confirmEditStatuses: ['En Proceso', 'Completada'],

  PAGE_SIZE: 20,

  roles: {
    admin:      { canCreate: true,  canEdit: true,  canDelete: true,  canSeeAll: true  },
    planta:     { canCreate: false, canEdit: false, canDelete: false, canSeeAll: true  },
    sucursal:   { canCreate: true,  canEdit: true,  canDelete: true,  canSeeAll: false },
    repartidor: { canCreate: false, canEdit: false, canDelete: false, canSeeAll: true  },
  },
};

export const BUSINESS_INFO = {
  instagram: 'xiera.xiera',
  phone:     '392 92 2 42 29',
  address:   'Ramón Corona 423, Centro, Ocotlán, Jalisco',
  facebook:  'Xiera',
};
