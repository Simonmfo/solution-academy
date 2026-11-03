/**
 * Solution Academy — Interactive Catalog, Syllabus Modal, Vocational Advisor & Direct Contact
 */

const ACADEMY_CONFIG = {
  instagramUrl: 'https://www.instagram.com/solution_academyy/',
  // Configure WhatsApp phone number here (international format without '+').
  // If left empty, clicking WhatsApp buttons smoothly scrolls and pre-fills the inscription form.
  whatsappNumber: ''
};

const COURSES_DATA = [
  {
    id: 'retroexcavadora',
    title: 'Operador de Retroexcavadora',
    category: 'maquinaria',
    categoryLabel: 'Maquinaria Pesada',
    icon: '🚜',
    duration: '6 Semanas (Intensivo)',
    modality: '80% Práctico en Predio',
    badge: 'Alta Demanda Vial',
    shortDesc: 'Aprendé desde cero el manejo seguro, excavación de zanjas, nivelación de terrenos y carga de camiones con retroexcavadora.',
    highlights: [
      'Prácticas reales en cabina con instructor 1 a 1',
      'Check-list pre-operacional y mantenimiento diario',
      'Entrega de Carnet de Operador y Certificado'
    ],
    syllabus: [
      'Módulo 1: Seguridad en obra vial, EPP y reconocimiento de mandos y sistemas hidráulicos.',
      'Módulo 2: Inspección pre-operacional (fluidos, engrase, neumáticos y bloqueos de seguridad).',
      'Módulo 3: Uso del balde frontal: nivelación, acopio de áridos y carga sobre camión.',
      'Módulo 4: Uso del brazo retroexcavador: posicionamiento de estabilizadores, zanjeo y excavación precisa.',
      'Módulo 5: Evaluación práctica final en terreno y entrega de credencial.'
    ],
    career: 'Empresas constructoras, obras viales, municipios, cooperativas de servicios, movimiento de suelos y canteras.'
  },
  {
    id: 'autoelevador',
    title: 'Operador de Autoelevador (Clark)',
    category: 'maquinaria',
    categoryLabel: 'Maquinaria y Logística',
    icon: '🏗️',
    duration: '4 Semanas / Jornadas Sábados',
    modality: 'Teórico + Práctico',
    badge: 'Normativa SRT 960/15',
    shortDesc: 'Capacitación integral en manejo de autoelevadores, estibaje en racks de altura, triángulo de estabilidad y seguridad logística.',
    highlights: [
      'Alineado a exigencias de seguridad industrial (Res. 960/15)',
      'Maniobras en pasillos estrechos y carga/descarga',
      'Rápida inserción en centros logísticos y depósitos'
    ],
    syllabus: [
      'Módulo 1: Normativa vigente de Higiene y Seguridad, triángulo de estabilidad y centro de gravedad.',
      'Módulo 2: Check-list diario de horquillas, cadenas, mástil, sistema hidráulico y baterías/GLP/diésel.',
      'Módulo 3: Circuito práctico: slalom, avance y retroceso con carga, giro en espacios reducidos.',
      'Módulo 4: Estibaje en altura (racks), carga y descarga de transporte y estacionamiento seguro.'
    ],
    career: 'Centros de distribución, parques industriales, depósitos mayoristas, plantas fabriles, puertos y corralones.'
  },
  {
    id: 'pala-cargadora',
    title: 'Operador de Pala Cargadora Frontal',
    category: 'maquinaria',
    categoryLabel: 'Maquinaria Pesada',
    icon: '⚙️',
    duration: '5 Semanas',
    modality: 'Práctico en Campo',
    badge: 'Especialidad Vial',
    shortDesc: 'Dominá la operación de pala frontal articulada para movimiento de grandes volúmenes de suelo, áridos y carga pesada.',
    highlights: [
      'Técnicas de ataque a pila, llenado de balde y acarreo',
      'Ciclos eficientes de carga en bateas y camiones',
      'Cuidado del convertidor de par y transmisión'
    ],
    syllabus: [
      'Módulo 1: Componentes del cargador frontal articulado, transmisión y sistema hidráulico de levante.',
      'Módulo 2: Seguridad en canteras, plantas de hormigón y obradores viales.',
      'Módulo 3: Técnicas de penetración, carga de áridos, nivelación y limpieza de playa.',
      'Módulo 4: Sincronización de ciclo en V para carga rápida de camiones volcadores.'
    ],
    career: 'Canteras, plantas hormigoneras, empresas de pavimentación, minería, agroindustria y grandes obras civiles.'
  },
  {
    id: 'minicargadora',
    title: 'Operador de Minicargadora (Bobcat)',
    category: 'maquinaria',
    categoryLabel: 'Maquinaria Pesada',
    icon: '🚧',
    duration: '4 Semanas',
    modality: 'Práctico en Predio',
    badge: 'Maniobra Ágil',
    shortDesc: 'Entrenamiento intensivo en giro sobre su propio eje, nivelación fina en espacios reducidos y acople de implementos.',
    highlights: [
      'Dominio de controles por comandos / joysticks',
      'Trabajo seguro en obras urbanas y espacios confinados',
      'Prácticas de nivelación, limpieza de obra y carga'
    ],
    syllabus: [
      'Módulo 1: Cabina ROPS/FOPS, barra de seguridad, bloqueo hidráulico y mantenimiento preventivo.',
      'Módulo 2: Sensibilidad de mandos combinados: traslación, giro 360° y control de balde.',
      'Módulo 3: Nivelación de sub-bases, distribución de tosca/piedra y carga en contenedores.',
      'Módulo 4: Acople rápido de accesorios y protocolos de transporte en tráiler.'
    ],
    career: 'Obras urbanas, empresas de demolición, paisajismo, pavimentación, countries y alquiler de maquinaria.'
  },
  {
    id: 'steel-framing',
    title: 'Construcción en Seco: Steel Framing y Durlock',
    category: 'construccion',
    categoryLabel: 'Construcción y Oficios',
    icon: '🏠',
    duration: '8 Semanas',
    modality: 'Taller 100% Práctico',
    badge: 'Oficio Muy Rentable',
    shortDesc: 'Aprendé el sistema constructivo de mayor crecimiento: montaje de estructuras metálicas, tabiquería, cielorrasos y aislaciones.',
    highlights: [
      'Armado real de paneles portantes, soleras y montantes',
      'Emplacado, tomado de juntas, masillado y terminación',
      'Cómputo de materiales y armado de presupuestos'
    ],
    syllabus: [
      'Módulo 1: Lectura de planos de taller, herramientas de corte/fijación y perfilería (PGC / PGU / Drywall).',
      'Módulo 2: Replanteo, armado de tabiques divisores, vanos de puertas/ventanas y cielorrasos.',
      'Módulo 3: Estructura Steel Framing: rigidización (Cruces de San Andrés, placa OSB), barreras de agua y viento (EIFS).',
      'Módulo 4: Aislaciones térmicas/acústicas, emplacado y técnicas profesionales de masillado.',
      'Módulo 5: Cómo cotizar el metro cuadrado de mano de obra y materiales.'
    ],
    career: 'Emprendimiento propio de construcción y reformas, contratistas de obra en seco y desarrolladoras inmobiliarias.'
  },
  {
    id: 'electricidad',
    title: 'Electricidad Domiciliaria y de Obra',
    category: 'construccion',
    categoryLabel: 'Construcción y Oficios',
    icon: '⚡',
    duration: '8 Semanas',
    modality: 'Taller Equipado',
    badge: 'Salida Independiente',
    shortDesc: 'Formate desde cero en instalaciones eléctricas seguras, armado de tableros, detección de fallas y normativas vigentes.',
    highlights: [
      'Prácticas reales sobre tableros de prueba individuales',
      'Cálculo de sección de cables, térmicas y disyuntores',
      'Uso de multímetro, pinza amperométrica y puesta a tierra'
    ],
    syllabus: [
      'Módulo 1: Magnitudes eléctricas, Ley de Ohm, seguridad eléctrica y uso de instrumental de medición.',
      'Módulo 2: Circuitos de iluminación, tomas de uso general/especial, llaves combinadas y sensores.',
      'Módulo 3: Armado de tableros seccionales: interruptores termomagnéticos, diferenciales (disyuntor) y puesta a tierra.',
      'Módulo 4: Canalizaciones en obra húmeda y en seco, diagnóstico de cortocircuitos y fugas.',
      'Módulo 5: Presupuestación por boca eléctrica y trato con el cliente.'
    ],
    career: 'Trabajo independiente en hogares, comercios y obras en construcción, o mantenimiento edilicio.'
  },
  {
    id: 'albanileria',
    title: 'Albañilería Integral, Planos y Cómputo',
    category: 'construccion',
    categoryLabel: 'Construcción y Oficios',
    icon: '🧱',
    duration: '8 Semanas',
    modality: 'Teórico + Práctico',
    badge: 'Base Constructiva',
    shortDesc: 'Dominá desde el replanteo de obra y nivelación hasta mampostería, revoques, contrapisos, carpetas y lectura de planos.',
    highlights: [
      'Interpretación de planos y cálculo exacto de materiales',
      'Uso de nivel láser, plomada, escuadra y dosificación',
      'Ideal para futuros jefes de cuadrilla y constructores'
    ],
    syllabus: [
      'Módulo 1: Lectura de planos de arquitectura, escalas, replanteo de terreno y nivelación.',
      'Módulo 2: Fundaciones, encadenados, hidrófugos y dosificación correcta de morteros y hormigones.',
      'Módulo 3: Levantamiento de mampostería (ladrillo hueco, común y bloques), plomo y nivel.',
      'Módulo 4: Contrapisos, carpetas de nivelación, revoque grueso/fino y colocación de aberturas.',
      'Módulo 5: Cómputo métrico de materiales y dirección básica de obra.'
    ],
    career: 'Empresas constructoras, contratistas independientes, remodelaciones integrales y conducción de cuadrillas.'
  },
  {
    id: 'soldadura',
    title: 'Soldadura Industrial (MIG / TIG / Electrodo)',
    category: 'industrial',
    categoryLabel: 'Industrial y Metalurgia',
    icon: '👨‍🏭',
    duration: '6 Semanas',
    modality: '100% Cabina de Soldadura',
    badge: 'Oficio Industrial',
    shortDesc: 'Entrenamiento práctico en procesos SMAW (Electrodo revestido), MIG-MAG (semiautomática) y principios de TIG.',
    highlights: [
      'Regulación de amperaje, voltaje y gases protectores',
      'Unión de perfiles estructurales, chapas y cañerías',
      'Seguridad en taller, amolado y control de deformaciones'
    ],
    syllabus: [
      'Módulo 1: Seguridad en soldadura, máscaras fotosensibles, tipos de aceros y preparación de biseles.',
      'Módulo 2: Proceso MMA / SMAW (Electrodo 6013 y 7018): encendido de arco, cordones planos y en ángulo.',
      'Módulo 3: Proceso MIG/MAG: regulación de velocidad de alambre, caudal de gas y soldadura continua.',
      'Módulo 4: Introducción a TIG, corte/desbaste seguro con amoladora y fabricación de estructuras metálicas.'
    ],
    career: 'Talleres metalúrgicos, montaje de galpones e industria, herrería de obra, reparación de equipos viales.'
  },
  {
    id: 'mantenimiento-seguridad',
    title: 'Mantenimiento Hidráulico y Seguridad en Obra',
    category: 'industrial',
    categoryLabel: 'Industrial y Seguridad',
    icon: '🛡️',
    duration: '5 Semanas',
    modality: 'Teórico + Taller',
    badge: 'Complemento Clave',
    shortDesc: 'Preventivo de motores diésel, sistemas oleohidráulicos de maquinaria pesada y protocolos de prevención de riesgos en obra.',
    highlights: [
      'Diagnóstico preventivo de mangueras, bombas y cilindros',
      'Prevención de accidentes, trabajo en altura y bloqueos LOTO',
      'Potenciá tu currículum como operador o supervisor'
    ],
    syllabus: [
      'Módulo 1: Fundamentos de motores diésel pesados: filtros, refrigeración, lubricación y turboalimentación.',
      'Módulo 2: Sistemas oleohidráulicos: bombas, válvulas direccionales, cilindros y detección de fugas.',
      'Módulo 3: Seguridad e Higiene en la Construcción (Decreto 911/96), Análisis de Trabajo Seguro (ATS).',
      'Módulo 4: Gestión de mantenimiento preventivo programado para flotas viales.'
    ],
    career: 'Auxiliar de mantenimiento de flotas viales, operador calificado, encargado de obrador y logística.'
  }
];

// ============================================================================
// DOM ELEMENTS & INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const coursesGrid = document.getElementById('courses-grid');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const searchInput = document.getElementById('course-search');
  const emptyState = document.getElementById('empty-state');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');

  const courseModal = document.getElementById('course-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalInscribeBtn = document.getElementById('modal-inscribe-btn');

  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');

  let activeCategory = 'todos';
  let searchQuery = '';

  // Update dynamic counts
  document.getElementById('count-todos').textContent = COURSES_DATA.length;
  document.getElementById('count-maquinaria').textContent = COURSES_DATA.filter(c => c.category === 'maquinaria').length;
  document.getElementById('count-construccion').textContent = COURSES_DATA.filter(c => c.category === 'construccion').length;
  document.getElementById('count-industrial').textContent = COURSES_DATA.filter(c => c.category === 'industrial').length;

  // Render Courses
  function renderCourses() {
    const filtered = COURSES_DATA.filter(course => {
      const matchesCategory = activeCategory === 'todos' || course.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.shortDesc.toLowerCase().includes(query) ||
        course.categoryLabel.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });

    coursesGrid.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    filtered.forEach(course => {
      const card = document.createElement('article');
      card.className = 'course-card';
      card.innerHTML = `
        <div class="course-card__top">
          <div class="course-card__badges">
            <div class="course-card__icon" aria-hidden="true">${course.icon}</div>
            <span class="course-card__tag">${course.badge}</span>
          </div>
          <h3 class="course-card__title">${course.title}</h3>
          <p class="course-card__desc">${course.shortDesc}</p>
          <ul class="course-card__highlights">
            ${course.highlights.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div class="course-card__meta">
            <span class="meta-pill">⏱️ ${course.duration}</span>
            <span class="meta-pill">🛠️ ${course.modality}</span>
          </div>
          <div class="course-card__footer">
            <button type="button" class="btn btn--outline btn--sm" data-open-modal="${course.id}">
              Ver Temario
            </button>
            <button type="button" class="btn btn--primary btn--sm" data-select-course="${course.title}">
              Inscribirme →
            </button>
          </div>
        </div>
      `;
      coursesGrid.appendChild(card);
    });
  }

  // Filter Tab Clicks
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeCategory = tab.dataset.filter;
      renderCourses();
    });
  });

  // Search Input
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderCourses();
  });

  resetFiltersBtn.addEventListener('click', () => {
    activeCategory = 'todos';
    searchQuery = '';
    searchInput.value = '';
    filterTabs.forEach(t => t.classList.toggle('active', t.dataset.filter === 'todos'));
    renderCourses();
  });

  // Jump Links that also set category filter
  document.querySelectorAll('[data-JumpFilter]').forEach(link => {
    link.addEventListener('click', () => {
      const targetFilter = link.getAttribute('data-JumpFilter');
      const targetTab = document.querySelector(`.filter-tab[data-filter="${targetFilter}"]`);
      if (targetTab) {
        targetTab.click();
      }
    });
  });

  // Delegated clicks inside Course Grid (Open Modal or Pre-fill Inscription)
  coursesGrid.addEventListener('click', e => {
    const modalBtn = e.target.closest('[data-open-modal]');
    if (modalBtn) {
      const courseId = modalBtn.getAttribute('data-open-modal');
      openCourseModal(courseId);
      return;
    }

    const selectBtn = e.target.closest('[data-select-course]');
    if (selectBtn) {
      const courseTitle = selectBtn.getAttribute('data-select-course');
      scrollToInscriptionWithCourse(courseTitle);
    }
  });

  // Modal Logic
  function openCourseModal(courseId) {
    const course = COURSES_DATA.find(c => c.id === courseId);
    if (!course) return;

    document.getElementById('modal-course-category').textContent = course.categoryLabel;
    document.getElementById('modal-course-title').textContent = course.title;
    document.getElementById('modal-course-desc').textContent = course.shortDesc;

    document.getElementById('modal-course-specs').innerHTML = `
      <span class="meta-pill">⏱️ Duración: ${course.duration}</span>
      <span class="meta-pill">🛠️ Modalidad: ${course.modality}</span>
      <span class="meta-pill">🎓 Incluye Certificación y Credencial</span>
    `;

    document.getElementById('modal-course-syllabus').innerHTML = course.syllabus
      .map(step => `<li>${step}</li>`)
      .join('');

    document.getElementById('modal-course-career').textContent = course.career;

    modalInscribeBtn.onclick = () => {
      courseModal.close();
      scrollToInscriptionWithCourse(course.title);
    };

    courseModal.showModal();
  }

  closeModalBtn.addEventListener('click', () => courseModal.close());
  courseModal.addEventListener('click', e => {
    const rect = courseModal.getBoundingClientRect();
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (clickedOutside) courseModal.close();
  });

  // Helper to pre-fill course in form and scroll smoothly
  function scrollToInscriptionWithCourse(courseTitle, customMsg = '') {
    const contactSection = document.getElementById('contacto');
    const courseSelect = document.getElementById('student-course');
    const msgBox = document.getElementById('student-message');

    if (courseSelect && courseTitle) {
      Array.from(courseSelect.options).forEach(opt => {
        if (opt.value === courseTitle) {
          courseSelect.value = courseTitle;
        }
      });
    }

    if (customMsg && msgBox) {
      msgBox.value = customMsg;
    }

    contactSection.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      document.getElementById('student-name')?.focus();
    }, 600);
  }

  // Mobile Menu Toggle
  menuToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ============================================================================
  // INTERACTIVE VOCATIONAL ADVISOR ("Test Vocacional Técnico")
  // ============================================================================
  const quizOptions = document.querySelectorAll('.quiz-option');
  const runAdvisorBtn = document.getElementById('run-advisor-btn');
  const quizForm = document.getElementById('quiz-form');
  const quizResult = document.getElementById('quiz-result');
  const resetQuizBtn = document.getElementById('reset-quiz-btn');

  quizOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.quiz-options');
      parent.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  runAdvisorBtn.addEventListener('click', () => {
    const ambiente = document.querySelector('[data-question="ambiente"] .quiz-option.active')?.dataset.value || 'vial';
    const meta = document.querySelector('[data-question="meta"] .quiz-option.active')?.dataset.value || 'empleo';

    const recommendations = {
      vial: {
        title: 'Operador de Retroexcavadora y Pala Cargadora',
        courseValue: 'Operador de Retroexcavadora',
        desc: 'Es el perfil más buscado en obras viales, municipios y movimiento de suelos. Con nuestras prácticas reales en cabina salís listo para superar pruebas técnicas de ingreso.',
        meta: ['⏱️ 6 Semanas', '🚜 80% Práctica en Campo', '🪪 Carnet Habilitante']
      },
      logistica: {
        title: 'Operador de Autoelevador (Clark) — Normativa SRT',
        courseValue: 'Operador de Autoelevador (Clark)',
        desc: 'Ideal para ingresar rápido en centros logísticos, fábricas, depósitos y corralones. Aprendés estibaje en altura y seguridad industrial bajo estándares vigentes.',
        meta: ['⏱️ 4 Semanas / Sábados', '📦 Alta Rotación Laboral', '🪪 Credencial Técnica']
      },
      obra: {
        title:
          meta === 'independiente'
            ? 'Construcción en Seco (Steel Framing & Durlock) + Electricidad'
            : 'Construcción en Seco: Steel Framing y Durlock',
        courseValue: 'Construcción en Seco: Steel Framing y Durlock',
        desc: 'El sistema de construcción en seco tiene altísima demanda tanto para trabajar por cuenta propia haciendo reformas y ampliaciones como en empresas constructoras.',
        meta: ['⏱️ 8 Semanas', '🏗️ Taller 100% Práctico', '📐 Incluye Presupuestación']
      },
      taller: {
        title: 'Soldadura Industrial (MIG / TIG / Electrodo)',
        courseValue: 'Soldadura Industrial (MIG / TIG / Electrodo)',
        desc: 'Un oficio técnico indispensable en metalúrgicas, montaje de galpones, mantenimiento de equipos pesados y fabricación de estructuras propias.',
        meta: ['⏱️ 6 Semanas', '👨‍🏭 Práctica en Cabina', '⚡ Alta Rentabilidad']
      }
    };

    const rec = recommendations[ambiente];
    document.getElementById('result-title').textContent = rec.title;
    document.getElementById('result-desc').textContent = rec.desc;
    document.getElementById('result-meta').innerHTML = rec.meta
      .map(m => `<span class="meta-pill">${m}</span>`)
      .join('');

    document.getElementById('result-wa-btn').onclick = () => {
      scrollToInscriptionWithCourse(rec.courseValue);
    };

    quizForm.hidden = true;
    quizResult.hidden = false;
  });

  resetQuizBtn.addEventListener('click', () => {
    quizResult.hidden = true;
    quizForm.hidden = false;
  });

  // ============================================================================
  // DIRECT WHATSAPP / INSTAGRAM INSCRIPTION HANDLER
  // ============================================================================
  const inscriptionForm = document.getElementById('inscription-form');

  inscriptionForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('student-name').value.trim();
    const phone = document.getElementById('student-phone').value.trim();
    const schedule = document.getElementById('student-schedule').value;
    const course = document.getElementById('student-course').value;
    const message = document.getElementById('student-message').value.trim();

    const textLines = [
      `¡Hola Solution Academy! 👋 Quiero recibir información para inscribirme:`,
      `• *Nombre:* ${name}`,
      `• *Teléfono:* ${phone}`,
      `• *Curso de interés:* ${course}`,
      `• *Disponibilidad:* ${schedule}`
    ];
    if (message) {
      textLines.push(`• *Consulta:* ${message}`);
    }

    const fullMessage = textLines.join('\n');

    if (ACADEMY_CONFIG.whatsappNumber) {
      const waUrl = `https://wa.me/${ACADEMY_CONFIG.whatsappNumber}?text=${encodeURIComponent(fullMessage)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Copy inquiry message to clipboard and open Instagram DM / WhatsApp selector
      if (navigator.clipboard) {
        navigator.clipboard.writeText(fullMessage).catch(() => {});
      }
      const waGenericUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMessage)}`;
      window.open(waGenericUrl, '_blank', 'noopener,noreferrer');
    }
  });

  // Quick WhatsApp / Consultation buttons
  document.getElementById('hero-whatsapp-btn')?.addEventListener('click', () => {
    scrollToInscriptionWithCourse('');
  });

  document.getElementById('floating-wa-btn')?.addEventListener('click', () => {
    scrollToInscriptionWithCourse('');
  });

  document.querySelectorAll('[data-whatsapp-msg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.getAttribute('data-whatsapp-msg');
      scrollToInscriptionWithCourse('', msg);
    });
  });

  // Gallery Tabs (📸 Prácticas e Instagram / ⭐ Testimonios)
  const galleryTabs = document.querySelectorAll('[data-gallery-tab]');
  const panelFotos = document.getElementById('panel-fotos');
  const panelTestimonios = document.getElementById('panel-testimonios');

  galleryTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      galleryTabs.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const target = btn.getAttribute('data-gallery-tab');
      if (panelFotos && panelTestimonios) {
        panelFotos.hidden = target !== 'fotos';
        panelTestimonios.hidden = target !== 'testimonios';
      }
    });
  });

  // Theme Toggle (Light by default like CTU, with Dark Mode switch)
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    if (themeIcon) {
      themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
    }
  });

  // Initial render
  renderCourses();
});

