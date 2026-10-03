
        /**
         * ================================================================
         *  SQP LEGAL CONSULTING - Cotizador Jurídico (v5 - todo en un solo archivo)
         *  - Logo SVG completo incrustado
         *  - Favicon generado desde el SVG
         *  - Métodos de pago fijos en el PDF
         *  - Envío por WhatsApp Web
         *  - Buzón de sugerencias (solo programador ve la lista)
         * ================================================================
         */

        // ================================================================
        //  UTILIDADES - Funciones reutilizables
        // ================================================================


        const QUOTES_KEY = 'sqp_quotes';
        const TEMPLATES_KEY = 'sqp_templates';
        const SUGGESTIONS_KEY = 'sqp_suggestions';
        const PROFILES_KEY = 'sqp_shared_profiles';
        const PROFILE_PREFERENCES_KIND = 'profile_preferences';
        const SUPABASE_URL = 'https://bcmzhicashtsdzlmqrif.supabase.co';
        const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EMThmpImC8ZlJhcUdkipOQ_GNvy8bgc';
        const sqpSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        let currentAuthUserId = null;
        let currentAuthRole = null;

        function localList(key) { try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } }
        const bucketWrites = new Map();
        async function persistRows(bucket, rows, key) {
            const previousWrite = bucketWrites.get(bucket) || Promise.resolve();
            const write = previousWrite.catch(() => {}).then(async () => {
                if (!currentAuthUserId || !currentAuthRole) throw new Error('Inicia sesión antes de guardar.');
                if (currentAuthRole === 'VIEWER') throw new Error('Tu perfil solo tiene permiso de lectura.');

                const previous = localList(key);
                const next = Array.isArray(rows) ? rows : [];
                const canManageAll = ['ADMIN', 'SUPERVISOR'].includes(currentAuthRole);
                const safe = next.map((row, index) => {
                    const id = String(row.id || row.quoteNumber || row.templateId || row.timestamp || `${bucket}-${crypto.randomUUID()}-${index}`);
                    const owner_id = row.owner_id || currentAuthUserId;
                    return { ...row, id, owner_id };
                });
                const nextIds = new Set(safe.map(row => String(row.id)));
                const deleteIds = previous
                    .filter(row => canManageAll || row.owner_id === currentAuthUserId)
                    .map(row => String(row.id || row.quoteNumber || row.templateId || row.timestamp || ''))
                    .filter(id => id && !nextIds.has(id));

                if (deleteIds.length) {
                    let deletion = sqpSupabase.from('sqp_app_data').delete().eq('bucket', bucket).in('id', deleteIds);
                    if (!canManageAll) deletion = deletion.eq('owner_id', currentAuthUserId);
                    const { error } = await deletion;
                    if (error) throw error;
                }

                const writable = safe.filter(row => canManageAll || row.owner_id === currentAuthUserId);
                const results = await Promise.all(writable.map(row => sqpSupabase.from('sqp_app_data').upsert({
                    bucket,
                    id: String(row.id),
                    owner_id: row.owner_id,
                    payload: row,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'bucket,id' })));
                const failed = results.find(result => result.error);
                if (failed) throw failed.error;

                // Local storage is a read cache only; publish the new cache after Supabase accepts the write.
                localStorage.setItem(key, JSON.stringify(safe));
                return safe;
            });
            bucketWrites.set(bucket, write);
            try { return await write; }
            finally { if (bucketWrites.get(bucket) === write) bucketWrites.delete(bucket); }
        }
        function getQuotes() { return localList(QUOTES_KEY); }
        function saveQuotes(rows) { return persistRows('quotes', rows, QUOTES_KEY); }
        async function incrementCounter() {
            const {data,error}=await sqpSupabase.rpc('next_sqp_quote_number');
            if(error) throw error;
            const n=Number(data);
            if (!Number.isSafeInteger(n) || n < 1) throw new Error('La base de datos devolvió un número de cotización inválido.');
            return n;
        }
        function getTemplates() { return localList(TEMPLATES_KEY).filter(row => row.recordType !== PROFILE_PREFERENCES_KIND); }
        function saveTemplates(rows) {
            const preferences = localList(TEMPLATES_KEY).filter(row => row.recordType === PROFILE_PREFERENCES_KIND);
            return persistRows('quote_templates', [...rows, ...preferences], TEMPLATES_KEY);
        }
        function getProfilePreferences() {
            return localList(TEMPLATES_KEY).find(row => row.recordType === PROFILE_PREFERENCES_KIND && row.owner_id === currentAuthUserId) || { signature: '', photo: '' };
        }
        async function saveProfilePreferences(preferences) {
            const rows = localList(TEMPLATES_KEY).filter(row => row.recordType !== PROFILE_PREFERENCES_KIND);
            const current = localList(TEMPLATES_KEY).find(row => row.recordType === PROFILE_PREFERENCES_KIND && row.owner_id === currentAuthUserId);
            rows.push({
                ...current,
                ...preferences,
                id: current?.id || `profile-preferences-${currentAuthUserId}`,
                owner_id: currentAuthUserId,
                recordType: PROFILE_PREFERENCES_KIND
            });
            return persistRows('quote_templates', rows, TEMPLATES_KEY);
        }
        function getSuggestions() { return localList(SUGGESTIONS_KEY); }
        function saveSuggestions(rows) { return persistRows('suggestions', rows.map(x => ({ ...x, id: x.id || `sugg-${crypto.randomUUID()}` })), SUGGESTIONS_KEY); }
        async function loadSharedCotizadorData() {
            const { data: auth, error: authError } = await sqpSupabase.auth.getUser();
            if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
            if (!auth.user) return null;
            currentAuthUserId = auth.user.id;
            const {data:profile,error:profileError}=await sqpSupabase.from('sqp_profiles')
              .select('id,email,name,role,active').eq('id',currentAuthUserId).maybeSingle();
            if(profileError) throw profileError;
            if(!profile||!profile.active) throw new Error('Tu perfil SQP no está activo. Contacta a un administrador.');
            currentAuthRole=profile.role;
            const { data: profiles, error: profilesError } = await sqpSupabase.from('sqp_profiles').select('id,email,name,role,active').order('name');
            if (profilesError) throw profilesError;
            localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles || []));
            const {data:rows,error}=await sqpSupabase.from('sqp_app_data')
              .select('bucket,id,payload,owner_id').in('bucket',['quotes','quote_templates','suggestions','clients']);
            if(error) throw error;
            const byBucket=b=> (rows||[]).filter(r=>r.bucket===b).map(r=>({...r.payload,id:r.payload?.id||r.id,owner_id:r.owner_id}));
            localStorage.setItem('sqp_shared_clients',JSON.stringify(byBucket('clients')));
            for(const [bucket,key] of [['quotes',QUOTES_KEY],['quote_templates',TEMPLATES_KEY],['suggestions',SUGGESTIONS_KEY]]) {
                const cloud=byBucket(bucket), local=localList(key);
                const seen=new Set(cloud.map((row,i)=>String(row.id||row.quoteNumber||row.templateId||row.timestamp||i)));
                const canImportLegacy = ['ADMIN', 'SUPERVISOR'].includes(profile.role);
                const localOnly=local.filter((row,i)=>{
                    const id=String(row.id||row.quoteNumber||row.templateId||row.timestamp||i);
                    if(seen.has(id)) return false;
                    return row.owner_id === currentAuthUserId || (!row.owner_id && canImportLegacy);
                });
                const merged=cloud.concat(localOnly);
                localStorage.setItem(key,JSON.stringify(merged));
                if(profile.role!=='VIEWER' && localOnly.length) await persistRows(bucket,merged,key);
                if(bucket==='quotes' && profile.role!=='VIEWER') {
                    for(const quote of merged) {
                        if(!quote.client_id && quote.client) {
                            quote.client_id=await ensureSharedClient(quote.client,quote.idDoc,quote.email,quote.phone);
                        }
                    }
                    localStorage.setItem(key,JSON.stringify(merged));
                    if (merged.some(quote => quote.client_id)) await persistRows('quotes',merged,key);
                }
            }
            return profile;
        }
        async function ensureSharedClient(name,documentNumber,email,phone) {
            const clients=localList('sqp_shared_clients');
            const norm=s=>(s||'').toString().trim().toLocaleLowerCase();
            const existing=clients.find(c=>(documentNumber&&(norm(c.passportNumber)===norm(documentNumber)||norm(c.document)===norm(documentNumber)))||(phone&&norm(c.phone)===norm(phone))||(email&&norm(c.email)===norm(email))||(name&&norm(c.fullName)===norm(name)));
            if(existing) return existing.id;
            const now=new Date().toISOString();
            const id='cot-client-'+crypto.randomUUID();
            const payload={id,fullName:name||'',firstName:(name||'').trim().split(/\s+/)[0]||'',lastName:(name||'').trim().split(/\s+/).slice(1).join(' '),passportNumber:documentNumber||'',document:documentNumber||'',code:id,executiveId:currentAuthUserId,email:email||'',phone:phone||'',nationality:'',issuingCountry:'',birthDate:'',expiryDate:'',sex:'',status:'NEW',origin:'cotizador',createdAt:now,updatedAt:now};
            const {error}=await sqpSupabase.from('sqp_app_data').insert({bucket:'clients',id,owner_id:currentAuthUserId,payload});
            if(error) throw error;
            clients.push({...payload,owner_id:currentAuthUserId});
            localStorage.setItem('sqp_shared_clients',JSON.stringify(clients));
            return id;
        }
        async function signOutSharedSession() { await sqpSupabase.auth.signOut(); }

        // ---- SANEAMIENTO ----
        function escapeHtml(text) {
            const value = String(text ?? '');
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return value.replace(/[&<>"']/g, function(m) { return map[m]; });
        }

        // ---- SESIÓN ----
        function clearSession() {
            document.getElementById('newUserPassword').value='';
            document.getElementById('usersModal').classList.remove('active');
            usageReport.reset();
            currentAuthUserId = null;
            currentAuthRole = null;
        }

        // ---- LOGO SVG (convertir a PNG para favicon y PDF) ----
        let cachedPdfLogoDataUri = null;

        function generatePdfLogoFallback() {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#166490';
            const radius = 20,
                x = 0,
                y = 0,
                w = 200,
                h = 200;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#D4B85C';
            ctx.font = 'bold 90px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SQP', 100, 105);
            ctx.font = '18px Arial, sans-serif';
            ctx.fillText('LEGAL', 100, 155);
            return canvas.toDataURL('image/png');
        }

        function getPdfLogoDataUri() {
            if (cachedPdfLogoDataUri) {
                return Promise.resolve(cachedPdfLogoDataUri);
            }
            return new Promise((resolve) => {
                const sourceSvg = document.getElementById('sqpLogoSvg');
                if (!sourceSvg) {
                    cachedPdfLogoDataUri = generatePdfLogoFallback();
                    resolve(cachedPdfLogoDataUri);
                    return;
                }
                const svgClone = sourceSvg.cloneNode(true);
                svgClone.removeAttribute('id');
                svgClone.setAttribute('width', '800');
                svgClone.setAttribute('height', '733');
                svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                const svgMarkup = new XMLSerializer().serializeToString(svgClone);
                const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
                const blobUrl = URL.createObjectURL(svgBlob);

                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = 800;
                    canvas.height = 733;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 800, 733);
                    URL.revokeObjectURL(blobUrl);
                    try {
                        cachedPdfLogoDataUri = canvas.toDataURL('image/png');
                    } catch (e) {
                        cachedPdfLogoDataUri = generatePdfLogoFallback();
                    }
                    resolve(cachedPdfLogoDataUri);
                };
                img.onerror = function() {
                    URL.revokeObjectURL(blobUrl);
                    cachedPdfLogoDataUri = generatePdfLogoFallback();
                    resolve(cachedPdfLogoDataUri);
                };
                img.src = blobUrl;
            });
        }

        // ---- LOADER ----
        function showLoader(text = 'Generando PDF…') {
            document.getElementById('loaderText').textContent = text;
            document.getElementById('loaderOverlay').classList.add('active');
        }

        function hideLoader() {
            document.getElementById('loaderOverlay').classList.remove('active');
        }

        // ================================================================
        //  DATOS ESTÁTICOS
        // ================================================================
        const defaultServices = [
            { name: 'Impuesto Al Estado', price: 0 },
            { name: 'Honorarios', price: 0 },
            { name: 'Gastos Administrativos', price: 0 },
            { name: 'Notificación', price: 0 },
            { name: 'Tribunal', price: 0 },
            { name: 'Honorarios + Membresia', price: 0 },
            { name: 'Multa', price: 0 },
            { name: 'Descuento', price: 0 }
        ];

        const requirementsList = [
            'Pasaporte vigente',
            'Fotos tamaño carnet',
            'Copia de cédula',
            'Comprobante de solvencia económica',
            'Recibo de domicilio/contrato de arrendamiento a su nombre'
        ];

        const procedureRequirements = {
            'Visa de turista.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Comprobante de solvencia económica'],
            'Visa de tránsito.': ['Pasaporte vigente', 'Fotos tamaño carnet'],
            'Extensión de visa de turista.': ['Pasaporte vigente', 'Comprobante de solvencia económica'],
            'Visa múltiple.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula'],
            'Visa para marinos.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula'],
            'Estudiantes.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
            'Reagrupación familiar.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Recibo de domicilio/contrato de arrendamiento a su nombre'],
            'Inversionista macroempresa.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
            'Inversión en bienes inmuebles.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
            'Rentista retirado.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
            'Jubilado o pensionado.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
            'Naturalización.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Recibo de domicilio/contrato de arrendamiento a su nombre'],
            'Profesional extranjero.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
        };

        // ================================================================
        //  VARIABLES GLOBALES DE LA APLICACIÓN
        // ================================================================
        let currentUser = null;
        let currentRole = null;
        let lastQuoteData = null;
        let pendingGenerate = null;
        let historyQuotes = [];

        // ================================================================
        //  AUTENTICACIÓN (LOGIN, LOGOUT, USUARIOS)
        // ================================================================

        // ---- LOGIN ----
        async function handleLogin() {
            const errorDiv=document.getElementById('loginError');
            const email=document.getElementById('loginEmail').value.trim();
            const password=document.getElementById('loginPassword').value;
            const button=document.getElementById('loginBtn');
            if(!email || !password) { errorDiv.textContent='Introduce tu correo y contraseña de SQP.'; return; }
            button.disabled=true;
            try {
                const {error}=await sqpSupabase.auth.signInWithPassword({email,password});
                if(error) throw error;
                const profile=await loadSharedCotizadorData();
                if(!profile) throw new Error('No se pudo validar la cuenta.');
                document.getElementById('loginPassword').value='';
                currentUser=profile.name||profile.email;
                currentRole=profile.role==='VIEWER'?'viewer':['ADMIN','SUPERVISOR'].includes(profile.role)?'admin':'executive';
                document.getElementById('loginScreen').style.display='none'; showApp(); errorDiv.textContent='';
            } catch(err) { console.error(err); clearSession(); errorDiv.textContent=err.message||'No se pudo validar la sesión compartida.'; }
            finally { button.disabled=false; }
        }

        async function resumeSharedSession() {
            const profile=await loadSharedCotizadorData();
            if(!profile) return false;
            currentUser=profile.name||profile.email;
            currentRole=profile.role==='VIEWER'?'viewer':['ADMIN','SUPERVISOR'].includes(profile.role)?'admin':'executive';
            return true;
        }

        // ---- LOGOUT ----
        async function handleLogout() {
            try { await signOutSharedSession(); }
            catch (error) { console.error('No se pudo cerrar la sesión remota:', error); }
            currentUser = null;
            currentRole = null;
            clearSession();
            const mainApp = document.getElementById('mainApp');
            mainApp.style.transform = 'scale(0)';
            mainApp.style.opacity = '0';
            setTimeout(() => {
                mainApp.style.display = 'none';
                const loginScreen = document.getElementById('loginScreen');
                loginScreen.style.display = 'block';
                loginScreen.style.transform = 'scale(1)';
                loginScreen.style.opacity = '1';
                document.getElementById('loginError').textContent = '';
            }, 300);
        }

        // ---- USUARIOS (ADMIN) ----
        function openUsersModal() {
            if (currentAuthRole !== 'ADMIN') { alert('Solo un administrador puede gestionar perfiles.'); return; }
            renderUsersList();
            document.getElementById('usersModal').classList.add('active');
        }

        function closeUsersModal() {
            document.getElementById('newUserPassword').value='';
            document.getElementById('newUserStatus').textContent='';
            document.getElementById('usersModal').classList.remove('active');
        }

        async function renderUsersList() {
            if (currentAuthRole !== 'ADMIN') return;
            const container=document.getElementById('usersList');
            container.innerHTML='<p>Cargando perfiles compartidos…</p>';
            const {data:profiles,error}=await sqpSupabase.from('sqp_profiles').select('id,email,name,role,active').order('name');
            if(error) { container.textContent='No se pudieron cargar perfiles: '+error.message; return; }
            container.innerHTML='';
            (profiles||[]).forEach(profile=>{
                const div=document.createElement('div');
                div.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:.5rem;border-bottom:1px solid var(--border);gap:1rem';
                const details=document.createElement('span');
                details.textContent=(profile.name||profile.email)+' · '+profile.email+' · '+profile.role+(profile.active?'':' · INACTIVO');
                const actions=document.createElement('div');
                actions.style.cssText='display:flex;align-items:center;gap:.5rem';
                const roleSelect=document.createElement('select');
                roleSelect.setAttribute('aria-label','Rol de '+(profile.name||profile.email));
                for(const [value,label] of [['EXECUTIVE','Ejecutivo'],['ADMIN','Administrador'],['SUPERVISOR','Supervisor'],['VIEWER','Solo lectura']]) {
                    const option=document.createElement('option');
                    option.value=value; option.textContent=label; roleSelect.appendChild(option);
                }
                roleSelect.value=profile.role;
                roleSelect.disabled=profile.id===currentAuthUserId;
                roleSelect.addEventListener('change',()=>toggleUserRole(profile.id,roleSelect.value));
                const state=document.createElement('button');
                state.textContent=profile.active?'Desactivar':'Activar';
                state.disabled=profile.id===currentAuthUserId;
                state.addEventListener('click',()=>deleteUser(profile.id,profile.name||profile.email,profile.active));
                actions.append(roleSelect,state); div.append(details,actions); container.append(div);
            });
            const add=document.getElementById('addUserBtn');
            if(add) add.textContent='Crear usuario';
        }

        async function toggleUserRole(profileId, role) {
            if(currentAuthRole!=='ADMIN') { alert('Acceso denegado.'); return; }
            if(profileId===currentAuthUserId || !['ADMIN','SUPERVISOR','EXECUTIVE','VIEWER'].includes(role)) return;
            const {error}=await sqpSupabase.from('sqp_profiles').update({role}).eq('id',profileId);
            if(error) alert('No se pudo actualizar el perfil compartido: '+error.message);
            await renderUsersList();
        }

        async function deleteUser(profileId, name, wasActive) {
            if(currentAuthRole!=='ADMIN') { alert('Acceso denegado.'); return; }
            if(profileId===currentAuthUserId) { alert('No puedes desactivar tu propio usuario.'); return; }
            if(!confirm(`¿${wasActive?'Desactivar':'Activar'} a ${name} en todas las apps SQP?`)) return;
            const {error}=await sqpSupabase.from('sqp_profiles').update({active:!wasActive}).eq('id',profileId);
            if(error) alert('No se pudo desactivar el perfil: '+error.message);
            await renderUsersList();
        }

        async function addUser() {
            if(currentAuthRole!=='ADMIN') { alert('Acceso denegado.'); return; }
            const name=document.getElementById('newUsername').value.trim();
            const email=document.getElementById('newUserEmail').value.trim();
            const password=document.getElementById('newUserPassword').value;
            const role=document.getElementById('newUserRole').value;
            const status=document.getElementById('newUserStatus');
            const button=document.getElementById('addUserBtn');
            if(button.disabled) return;
            if(!name || !document.getElementById('newUserEmail').checkValidity() || !email ||
               password.length<12 || password.length>128 || !['ADMIN','SUPERVISOR','EXECUTIVE','VIEWER'].includes(role)) {
                status.textContent='Completa nombre, correo válido, rol y contraseña de 12 a 128 caracteres.';
                return;
            }
            const requestingUser=currentAuthUserId;
            button.disabled=true;
            status.textContent='Creando usuario…';
            try {
                const {data,error}=await sqpSupabase.functions.invoke('cotizador-users',{body:{name,email,password,role}});
                if(currentAuthUserId!==requestingUser || currentAuthRole!=='ADMIN') return;
                if(error) {
                    const detail=await error.context?.json?.().catch(()=>null);
                    throw new Error(detail?.error||'No se pudo crear la cuenta. Comprueba la lista antes de reintentar.');
                }
                if(!data?.id) throw new Error('No se pudo confirmar la creación. Comprueba la lista antes de reintentar.');
                document.getElementById('newUsername').value='';
                document.getElementById('newUserEmail').value='';
                status.textContent='Usuario creado. Puede iniciar sesión con el correo y la contraseña asignados.';
                await renderUsersList();
            } catch(error) { status.textContent=error.message||'No se pudo crear el usuario.'; }
            finally {
                document.getElementById('newUserPassword').value='';
                button.disabled=false;
            }
        }

        // ================================================================
        //  PERFIL DE USUARIO
        // ================================================================

        function openProfileModal() {
            const preferences = getProfilePreferences();
            document.getElementById('profileSignature').value = preferences.signature || '';
            updateSignaturePreview();
            document.getElementById('profileModal').classList.add('active');
        }

        function closeProfileModal() {
            document.getElementById('profileModal').classList.remove('active');
        }

        function updateSignaturePreview() {
            const sig = document.getElementById('profileSignature').value || 'Saludos cordiales,\nSQP LEGAL CONSULTING.';
            document.getElementById('signaturePreview').textContent = sig;
        }

        function optimizeProfileImage(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        canvas.width = 200;
                        canvas.height = 200;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, 200, 200);
                        resolve(canvas.toDataURL('image/jpeg', 0.7));
                    };
                    img.onerror = reject;
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        async function updateProfile() {
            const newPass = document.getElementById('profileNewPassword').value;
            const confirm = document.getElementById('profileConfirmPassword').value;
            const errorDiv = document.getElementById('profileError');
            if (newPass && newPass !== confirm) {
                errorDiv.textContent = 'Las contraseñas no coinciden.';
                return;
            }

            try {
                const signature = document.getElementById('profileSignature').value.trim();
                const preferences = getProfilePreferences();

                const file = document.getElementById('profilePicInput').files[0];
                if (file) {
                    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
                        throw new Error('Selecciona una imagen de máximo 5 MB.');
                    }
                    preferences.photo = await optimizeProfileImage(file);
                }

                if (newPass) {
                    const { error } = await sqpSupabase.auth.updateUser({ password: newPass });
                    if (error) throw error;
                }

                await saveProfilePreferences({ ...preferences, signature });
                updateProfilePic();
                closeProfileModal();
                alert('Perfil actualizado.');
                errorDiv.textContent = '';
            } catch (err) {
                errorDiv.textContent = 'No se pudo guardar el perfil: ' + err.message;
            }
        }

        function updateProfilePic() {
            const photo = getProfilePreferences().photo || '';
            const pic = document.getElementById('profilePicDisplay');
            const preview = document.getElementById('profilePicPreview');
            if (photo) {
                pic.src = photo;
                pic.style.display = 'inline-block';
                if (preview) preview.src = photo;
            } else {
                const defaultAvatar =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="35" r="25" fill="%23ccc"/%3E%3Cpath d="M25 80 Q50 95 75 80" fill="%23ccc"/%3E%3C/svg%3E';
                pic.src = defaultAvatar;
                pic.style.display = 'none';
                if (preview) preview.src = defaultAvatar;
            }
        }

        function getSignature() {
            return getProfilePreferences().signature || 'Saludos cordiales,\nSQP LEGAL CONSULTING.';
        }

        // ================================================================
        //  DASHBOARD (ESTADÍSTICAS)
        // ================================================================

        function openDashboard() {
            if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
            document.getElementById('dashboardModal').classList.add('active');
            renderDashboard();
        }

        function closeDashboard() {
            document.getElementById('dashboardModal').classList.remove('active');
        }

        function renderDashboard() {
            const quotes = getQuotes();
            const counts = {};
            quotes.forEach(q => { counts[q.executive] = (counts[q.executive] || 0) + 1; });
            const tbody = document.getElementById('dashboardBody');
            tbody.innerHTML = '';
            const profiles = localList(PROFILES_KEY);
            profiles.filter(profile => profile.active && profile.role === 'EXECUTIVE').forEach(profile => {
                const exec = profile.name || profile.email;
                const tr = document.createElement('tr');
                const nameCell = document.createElement('td');
                const countCell = document.createElement('td');
                nameCell.textContent = exec;
                countCell.textContent = String(counts[exec] || 0);
                tr.append(nameCell, countCell);
                tbody.appendChild(tr);
            });
        }

        // ================================================================
        //  HISTORIAL
        // ================================================================

        function openHistoryModal() {
            if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
            historyQuotes = getQuotes();
            document.getElementById('historyModal').classList.add('active');
            renderHistory(historyQuotes);
        }

        function closeHistoryModal() {
            document.getElementById('historyModal').classList.remove('active');
        }

        function renderHistory(quotes) {
            const tbody = document.getElementById('historyBody');
            tbody.innerHTML = '';
            if (quotes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay cotizaciones</td></tr>';
                return;
            }
            quotes.slice().reverse().forEach(q => {
                const statusClass = {
                    'pendiente': 'status-pendiente',
                    'aprobada': 'status-aprobada',
                    'rechazada': 'status-rechazada',
                    'convertida': 'status-convertida',
                    'enviada': 'status-enviada'
                } [q.status] || 'status-pendiente';
                const statusLabel = {
                    'pendiente': 'Pendiente',
                    'aprobada': 'Aprobada',
                    'rechazada': 'Rechazada',
                    'convertida': 'Convertida',
                    'enviada': 'Enviada'
                } [q.status] || 'Pendiente';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                            <td>${escapeHtml(q.quoteNumber || 'N/A')}</td>
                            <td>${new Date(q.date).toLocaleString()}</td>
                            <td>${escapeHtml(q.executive)}</td>
                            <td>${escapeHtml(q.client)}</td>
                            <td>${escapeHtml(q.procedure)}</td>
                            <td>$${q.total.toFixed(2)}</td>
                            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                            <td>
                                <select class="status-select" data-quote="${escapeHtml(q.quoteNumber)}">
                                    <option value="pendiente" ${q.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                    <option value="enviada" ${q.status === 'enviada' ? 'selected' : ''}>Enviada</option>
                                    <option value="aprobada" ${q.status === 'aprobada' ? 'selected' : ''}>Aprobada</option>
                                    <option value="rechazada" ${q.status === 'rechazada' ? 'selected' : ''}>Rechazada</option>
                                    <option value="convertida" ${q.status === 'convertida' ? 'selected' : ''}>Convertida</option>
                                </select>
                                <button class="btn-sm delete-quote-btn" data-quote="${escapeHtml(q.quoteNumber)}" style="background:#d0103a;color:white;border:none;border-radius:6px;padding:0.2rem 0.6rem;margin-left:0.3rem;">🗑️</button>
                            </td>
                        `;
                tbody.appendChild(tr);
            });

            document.querySelectorAll('.status-select').forEach(sel => {
                sel.addEventListener('change', function() {
                    const quoteNum = this.dataset.quote;
                    const newStatus = this.value;
                    changeQuoteStatus(quoteNum, newStatus).catch(error => alert('No se pudo guardar el estado: ' + error.message));
                });
            });

            document.querySelectorAll('.delete-quote-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const quoteNum = this.dataset.quote;
                    deleteQuote(quoteNum).catch(error => alert('No se pudo eliminar la cotización: ' + error.message));
                });
            });
        }

        async function changeQuoteStatus(quoteNumber, newStatus) {
            if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
            const quotes = getQuotes();
            const idx = quotes.findIndex(q => q.quoteNumber === quoteNumber);
            if (idx !== -1) {
                const oldStatus = quotes[idx].status;
                quotes[idx].status = newStatus;
                if (!quotes[idx].logs) quotes[idx].logs = [];
                quotes[idx].logs.push({
                    action: 'status_change',
                    from: oldStatus,
                    to: newStatus,
                    by: currentUser,
                    date: new Date().toISOString()
                });
                await saveQuotes(quotes);
                const filtered = applyFiltersSilent();
                renderHistory(filtered);
            }
        }

        async function deleteQuote(quoteNumber) {
            if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
            if (!confirm(`¿Eliminar la cotización ${quoteNumber}?`)) return;
            let quotes = getQuotes();
            quotes = quotes.filter(q => q.quoteNumber !== quoteNumber);
            await saveQuotes(quotes);
            const filtered = applyFiltersSilent();
            renderHistory(filtered);
        }

        function applyFiltersSilent() {
            const client = document.getElementById('filterClient').value.toLowerCase().trim();
            const exec = document.getElementById('filterExecutive').value.toLowerCase().trim();
            const proc = document.getElementById('filterProcedure').value.toLowerCase().trim();
            const from = document.getElementById('filterDateFrom').value;
            const to = document.getElementById('filterDateTo').value;
            let filtered = getQuotes().filter(q => {
                if (client && !String(q.client || '').toLowerCase().includes(client)) return false;
                if (exec && !String(q.executive || '').toLowerCase().includes(exec)) return false;
                if (proc && !String(q.procedure || '').toLowerCase().includes(proc)) return false;
                if (from) {
                    const d = new Date(q.date);
                    const f = new Date(from);
                    if (d < f) return false;
                }
                if (to) {
                    const d = new Date(q.date);
                    const t = new Date(to);
                    t.setHours(23, 59, 59);
                    if (d > t) return false;
                }
                return true;
            });
            return filtered;
        }

        function applyFilters() {
            const filtered = applyFiltersSilent();
            renderHistory(filtered);
        }

        function clearFilters() {
            document.getElementById('filterClient').value = '';
            document.getElementById('filterExecutive').value = '';
            document.getElementById('filterProcedure').value = '';
            document.getElementById('filterDateFrom').value = '';
            document.getElementById('filterDateTo').value = '';
            renderHistory(getQuotes());
        }

        function csvCell(value) {
            let text = String(value ?? '');
            if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        }

        function exportCsv() {
            const filtered = applyFiltersSilent();
            if (filtered.length === 0) {
                alert('No hay datos para exportar.');
                return;
            }
            const headers = ['Número', 'Fecha', 'Ejecutivo', 'Cliente', 'Trámite', 'Total', 'Estado'];
            const rows = filtered.map(q => [
                q.quoteNumber || '',
                new Date(q.date).toLocaleString(),
                q.executive,
                q.client,
                q.procedure,
                q.total.toFixed(2),
                q.status || 'pendiente'
            ]);
            const csvContent = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `historial_cotizaciones_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        }

        // ================================================================
        //  PLANTILLAS DE SERVICIOS
        // ================================================================

        function openTemplatesModal() {
            document.getElementById('templatesModal').classList.add('active');
            renderTemplates();
        }

        function closeTemplatesModal() {
            document.getElementById('templatesModal').classList.remove('active');
        }

        function renderTemplates() {
            const templates = getTemplates();
            const container = document.getElementById('templatesList');
            container.innerHTML = '';
            if (templates.length === 0) {
                container.innerHTML = '<p>No hay plantillas guardadas.</p>';
                return;
            }
            templates.forEach((t, idx) => {
                const div = document.createElement('div');
                div.className = 'template-item';
                div.innerHTML = `
                            <span><strong>${escapeHtml(t.name)}</strong> (${t.services.length} servicios)</span>
                            <div>
                                <button data-idx="${idx}" class="loadTemplateBtn" title="Cargar">📂</button>
                                <button data-idx="${idx}" class="deleteTemplateBtn" title="Eliminar">🗑️</button>
                            </div>
                        `;
                container.appendChild(div);
            });
            document.querySelectorAll('.loadTemplateBtn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = parseInt(this.dataset.idx);
                    loadTemplate(idx);
                });
            });
            document.querySelectorAll('.deleteTemplateBtn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = parseInt(this.dataset.idx);
                    if (confirm('¿Eliminar esta plantilla?')) {
                        const templates = getTemplates();
                        templates.splice(idx, 1);
                        saveTemplates(templates).then(renderTemplates).catch(error => alert('No se pudo eliminar la plantilla: ' + error.message));
                    }
                });
            });
        }

        async function saveCurrentTemplate() {
            const name = document.getElementById('templateName').value.trim();
            if (!name) { alert('Ingrese un nombre para la plantilla.'); return; }
            const services = [];
            let invalidPrice = false;
            document.querySelectorAll('.extra-service-check:checked').forEach((cb, idx) => {
                const priceInput = document.getElementById(`price_${idx}`);
                const price = getPriceFromInput(priceInput);
                if (price === null) { invalidPrice = true; return; }
                services.push({ name: cb.value, price: price });
            });
            if (invalidPrice) { alert('Revisa los importes: usa números con máximo dos decimales.'); return; }
            if (services.length === 0) { alert('Seleccione al menos un servicio.'); return; }
            const procedure = document.getElementById('procedureSearch').value.trim() || '';
            const requirements = Array.from(document.querySelectorAll('.requirement-check:checked')).map(cb => cb.value);
            const templates = getTemplates();
            templates.push({ templateId: `template-${crypto.randomUUID()}`, name, services, procedure, requirements });
            try {
                await saveTemplates(templates);
                document.getElementById('templateName').value = '';
                renderTemplates();
                alert('Plantilla guardada en la base de datos.');
            } catch (error) {
                alert('No se pudo guardar la plantilla: ' + error.message);
            }
        }

        function loadTemplate(idx) {
            const templates = getTemplates();
            const template = templates[idx];
            if (!template) return;
            document.querySelectorAll('.extra-service-check').forEach(cb => cb.checked = false);
            document.querySelectorAll('.service-price-input').forEach(inp => {
                inp.value = '';
                inp.setAttribute('data-raw', '');
            });
            document.querySelectorAll('.requirement-check').forEach(cb => cb.checked = false);
            const serviceNames = defaultServices.map(s => s.name);
            template.services.forEach(s => {
                const index = serviceNames.indexOf(s.name);
                if (index !== -1) {
                    const cb = document.getElementById(`service_${index}`);
                    if (cb) cb.checked = true;
                    const priceInput = document.getElementById(`price_${index}`);
                    if (priceInput) {
                        priceInput.value = s.price.toFixed(2);
                        priceInput.setAttribute('data-raw', s.price.toString());
                    }
                }
            });
            if (template.procedure) {
                document.getElementById('procedureSearch').value = template.procedure;
                autoSelectRequirements(template.procedure);
            }
            if (template.requirements && template.requirements.length > 0) {
                document.querySelectorAll('.requirement-check').forEach(cb => {
                    if (template.requirements.includes(cb.value)) {
                        cb.checked = true;
                    }
                });
            }
            closeTemplatesModal();
        }

        // ================================================================
        //  COTIZACIONES (GENERACIÓN)
        // ================================================================

        function buildServicesList() {
            const container = document.getElementById('servicesList');
            container.innerHTML = '';
            defaultServices.forEach((service, index) => {
                const div = document.createElement('div');
                div.className = 'service-item';
                div.innerHTML = `
                            <input type="checkbox" class="extra-service-check" id="service_${index}" value="${service.name}">
                            <span>${service.name}</span>
                            <input type="text" class="service-price-input" id="price_${index}" placeholder="$0.00" inputmode="decimal">
                        `;
                container.appendChild(div);
            });
            document.querySelectorAll('.service-price-input').forEach(input => {
                input.addEventListener('focus', handlePriceFocus);
                input.addEventListener('blur', handlePriceBlur);
                input.addEventListener('input', function(e) {
                    this.value = this.value.replace(/[^0-9.\-]/g, '');
                });
            });
        }

        function buildRequirementsList() {
            const grid = document.getElementById('requirementsGrid');
            grid.innerHTML = '';
            requirementsList.forEach(req => {
                const label = document.createElement('label');
                label.className = 'requirement-option';
                label.innerHTML = `<input type="checkbox" class="requirement-check" value="${req}"> ${req}`;
                grid.appendChild(label);
            });
        }

        function autoSelectRequirements(procedure) {
            const reqs = procedureRequirements[procedure] || [];
            document.querySelectorAll('.requirement-check').forEach(cb => {
                cb.checked = reqs.includes(cb.value);
            });
        }

        function handlePriceFocus(e) {
            const raw = e.target.getAttribute('data-raw');
            e.target.value = raw || e.target.value.replace(/,/g, '');
        }

        function handlePriceBlur(e) {
            let val = e.target.value.trim();
            if (val === '') { e.target.value = ''; e.target.setAttribute('data-raw', ''); return; }
            let num = parseFloat(val.replace(/,/g, ''));
            if (isNaN(num)) { e.target.value = ''; return; }
            e.target.setAttribute('data-raw', num.toString());
            e.target.value = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        function getPriceFromInput(input) {
            const val = input?.value.trim().replace(/,/g, '') || '';
            if (val === '') return 0;
            if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(val)) return null;
            const num = Number(val);
            return Number.isFinite(num) ? num : null;
        }

        function calculateQuote() {
            const procedureText = document.getElementById('procedureSearch').value.trim();
            if (!procedureText) { alert('Seleccione un trámite.'); return null; }
            const people = Number(document.getElementById('peopleCount').value);
            if (!Number.isInteger(people) || people < 1 || people > 20) {
                alert('La cantidad de personas debe ser un número entero entre 1 y 20.');
                return null;
            }
            const services = [];
            let subtotal = 0, discountPerPerson = 0;
            document.querySelectorAll('.extra-service-check').forEach((cb, idx) => {
                if (cb.checked) {
                    const priceInput = document.getElementById(`price_${idx}`);
                    const price = getPriceFromInput(priceInput);
                    if (price === null) {
                        throw new Error(`Ingrese un importe válido para "${cb.value}" (máximo dos decimales).`);
                    }
                    if (cb.value === 'Descuento') {
                        discountPerPerson = price;
                    } else {
                        const lineTotal = price * people;
                        services.push({ name: cb.value, unitPrice: price, quantity: people, price: lineTotal });
                        subtotal += lineTotal;
                    }
                }
            });
            const discount = discountPerPerson * people;
            if (discount > subtotal) {
                alert('El descuento por persona no puede superar el subtotal por persona.');
                return null;
            }
            const total = subtotal - discount;
            const reqs = Array.from(document.querySelectorAll('.requirement-check:checked')).map(cb => cb.value);
            return {
                procedure: procedureText,
                people: people,
                services: services,
                subtotal: subtotal,
                discount: discount,
                discountPerPerson: discountPerPerson,
                total: total,
                requirements: reqs,
                observations: document.getElementById('observations').value.trim(),
                executive: currentUser,
                status: 'pendiente'
            };
        }

        function showSummary() {
            const clientName = document.getElementById('clientName').value.trim();
            if (!clientName) { alert('Nombre del cliente obligatorio.'); return; }

            if (lastQuoteData) {
                if (!confirm(`Se actualizará la cotización ${lastQuoteData.quoteNumber}, ¿continuar?`)) {
                    return;
                }
            }

            let data;
            try {
                data = calculateQuote();
            } catch (error) {
                alert(error.message);
                return;
            }
            if (!data) return;

            pendingGenerate = data;

            const summaryDiv = document.getElementById('summaryContent');
            let html = `
                        <p><strong>Cliente:</strong> ${escapeHtml(clientName)}</p>
                        <p><strong>Trámite:</strong> ${escapeHtml(data.procedure)}</p>
                        <p><strong>Cantidad de personas:</strong> ${data.people}</p>
                        <p><strong>Servicios adicionales:</strong></p>
                        <ul style="margin-left:1.5rem;">
                    `;
            if (data.services.length === 0) {
                html += '<li>Ninguno seleccionado</li>';
            } else {
                data.services.forEach(s => {
                    html += `<li>${escapeHtml(s.name)}: ${s.quantity} × $${s.unitPrice.toFixed(2)} = $${s.price.toFixed(2)}</li>`;
                });
                if (data.discount > 0) {
                    html += `<li>🔻 Descuento: ${data.people} × $${data.discountPerPerson.toFixed(2)} = $${data.discount.toFixed(2)}</li>`;
                }
            }
            html += `</ul><p><strong>Total a pagar:</strong> $${data.total.toFixed(2)} USD</p>`;
            if (data.requirements.length > 0) {
                html += `<p><strong>Requisitos:</strong> ${data.requirements.map(escapeHtml).join(', ')}</p>`;
            }
            summaryDiv.innerHTML = html;
            document.getElementById('summaryModal').classList.add('active');
        }

        async function confirmGenerate() {
            if (!pendingGenerate) return;
            const data = pendingGenerate;
            const clientName = document.getElementById('clientName').value.trim();
            const idDoc = document.getElementById('clientId').value.trim();
            const email = document.getElementById('clientEmail').value.trim();
            const phone = document.getElementById('clientPhone').value.trim();

            // Keep raw client text in the database; escape it only when rendering HTML.
            const quoteFields = data;

            if (lastQuoteData) {
                const quotes = getQuotes();
                const idx = quotes.findIndex(q => q.quoteNumber === lastQuoteData.quoteNumber);
                if (idx !== -1) {
                    const oldDate = quotes[idx].date;
                    const oldLogs = quotes[idx].logs || [];
                    const newQuote = {
                        ...quoteFields,
                        client: clientName,
                        client_id: await ensureSharedClient(clientName, idDoc, email, phone),
                        idDoc: idDoc,
                        email: email,
                        phone: phone,
                        quoteNumber: lastQuoteData.quoteNumber,
                        date: oldDate,
                        executive: currentUser,
                        logs: [...oldLogs, { action: 'regenerated', by: currentUser, date: new Date().toISOString() }]
                    };
                    quotes[idx] = newQuote;
                    await saveQuotes(quotes);
                    lastQuoteData = newQuote;
                    displayQuote(newQuote);
                    document.getElementById('summaryModal').classList.remove('active');
                    pendingGenerate = null;
                    return;
                }
            }

            const counter = await incrementCounter();
            const year = new Date().getFullYear();
            const quoteNumber = `COT-${year}-${String(counter).padStart(4, '0')}`;
            const sharedClientId = await ensureSharedClient(clientName, idDoc, email, phone);

            const quoteData = {
                ...quoteFields,
                client: clientName,
                client_id: sharedClientId,
                idDoc: idDoc,
                email: email,
                phone: phone,
                quoteNumber: quoteNumber,
                date: new Date().toISOString(),
                executive: currentUser,
                logs: [{ action: 'generated', by: currentUser, date: new Date().toISOString() }],
                reminderSent: false
            };

            const quotes = getQuotes();
            quotes.push(quoteData);
            await saveQuotes(quotes);

            lastQuoteData = quoteData;
            displayQuote(quoteData);
            document.getElementById('summaryModal').classList.remove('active');
            pendingGenerate = null;
        }

        function cancelGenerate() {
            document.getElementById('summaryModal').classList.remove('active');
            pendingGenerate = null;
        }

        function displayQuote(data) {
            document.getElementById('bannerTitle').textContent = `Presupuesto de ${data.procedure}`;
            document.getElementById('quoteNumber').textContent = `📄 ${data.quoteNumber}`;

            document.getElementById('clientInfoDisplay').innerHTML = `
                        <strong>Cliente:</strong> ${escapeHtml(data.client) || 'No especificado'}<br>
                        <strong>Cédula/Pasaporte:</strong> ${escapeHtml(data.idDoc) || '-'}<br>
                        <strong>Correo:</strong> ${escapeHtml(data.email) || '-'}<br>
                        <strong>Teléfono:</strong> ${escapeHtml(data.phone) || '-'}
                    `;
            document.getElementById('executiveInfo').innerHTML = `<strong>Ejecutivo:</strong> ${escapeHtml(data.executive)}`;
            document.getElementById('requirementsInfo').innerHTML =
                data.requirements.length ? `<strong>Requisitos:</strong> ${data.requirements.map(escapeHtml).join(', ')}` : '';

            const obsDiv = document.getElementById('observationsInfo');
            obsDiv.style.display = data.observations ? 'block' : 'none';
            obsDiv.innerHTML = data.observations ? `<strong>📝 Observaciones:</strong><br>${escapeHtml(data.observations)}` :
                '';

            const tbody = document.getElementById('breakdownBody');
            tbody.innerHTML = '';

            if (data.services.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="4" style="text-align:center; color:#888;">No hay servicios adicionales seleccionados</td></tr>`;
            } else {
                data.services.forEach(s => {
                    const quantity = Number.isInteger(s.quantity) && s.quantity > 0 ? s.quantity : 1;
                    const lineTotal = Number.isFinite(s.price) ? s.price : 0;
                    const unitPrice = Number.isFinite(s.unitPrice) ? s.unitPrice : lineTotal / quantity;
                    tbody.innerHTML +=
                        `<tr><td>${escapeHtml(s.name)}</td><td>${quantity}</td><td>$${unitPrice.toFixed(2)}</td><td>$${lineTotal.toFixed(2)}</td></tr>`;
                });
                if (data.discount > 0) {
                    const discountQuantity = Number.isInteger(data.people) && data.discountPerPerson !== undefined ? data.people : 1;
                    const discountUnit = data.discountPerPerson !== undefined ? data.discountPerPerson : data.discount;
                    tbody.innerHTML +=
                        `<tr><td>🔻 Descuento</td><td>${discountQuantity}</td><td>$${discountUnit.toFixed(2)}</td><td>$${data.discount.toFixed(2)}</td></tr>`;
                }
            }

            tbody.innerHTML +=
                `<tr class="total-row"><td colspan="3"><strong>TOTAL</strong></td><td><strong>$${data.total.toFixed(2)}</strong></td></tr>`;
            document.getElementById('finalTotal').textContent = `Total a pagar: $${data.total.toFixed(2)} USD`;

            document.getElementById('formSection').style.display = 'none';
            document.getElementById('quoteResult').classList.add('active');
        }

        function resetForm() {
            document.getElementById('formSection').style.display = 'block';
            document.getElementById('quoteResult').classList.remove('active');
            document.querySelectorAll('.extra-service-check').forEach(cb => cb.checked = false);
            document.querySelectorAll('.requirement-check').forEach(cb => cb.checked = false);
            document.querySelectorAll('.service-price-input').forEach(inp => { inp.value = '';
                inp.setAttribute('data-raw', ''); });
            document.getElementById('clientName').value = '';
            document.getElementById('clientId').value = '';
            document.getElementById('clientEmail').value = '';
            document.getElementById('clientPhone').value = '';
            document.getElementById('procedureSearch').value = '';
            document.getElementById('observations').value = '';
            lastQuoteData = null;
            pendingGenerate = null;
        }

        // ================================================================
        //  GENERACIÓN DE PDF (CON MÉTODOS DE PAGO INCLUIDOS)
        // ================================================================

        function buildPdfFile() {
            return new Promise((resolve, reject) => {
                if (!lastQuoteData) {
                    reject('No hay cotización');
                    return;
                }
                showLoader('Generando PDF…');
                const element = document.getElementById('printableQuote');
                const clientName = lastQuoteData.client || 'SQP';
                const sanitized = clientName.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/g, '').trim().replace(/\s+/g, '_');
                const filename = `Presupuesto_${sanitized}.pdf`;

                const logoImg = document.getElementById('pdfLogoImg');

                const opt = {
                    margin: [0.5, 0.5, 0.5, 0.5],
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        letterRendering: true,
                        allowTaint: false,
                        logging: false,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: document.documentElement.scrollWidth,
                        windowHeight: document.documentElement.scrollHeight
                    },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'] }
                };

                getPdfLogoDataUri().then((dataUri) => {
                    if (logoImg.src === dataUri && logoImg.complete && logoImg.naturalWidth > 0) {
                        return Promise.resolve();
                    }
                    return new Promise((res) => {
                        logoImg.addEventListener('load', res, { once: true });
                        logoImg.addEventListener('error', res, { once: true });
                        logoImg.src = dataUri;
                    });
                }).then(() => {
                    return (logoImg.decode ? logoImg.decode().catch(() => {}) : Promise.resolve());
                }).then(() => {
                    // El apartado de pagos ya está en el DOM, se incluye automáticamente
                    return html2pdf().set(opt).from(element).outputPdf('blob');
                }).then((blob) => {
                    hideLoader();
                    const file = new File([blob], filename, { type: 'application/pdf' });
                    resolve(file);
                }).catch(err => {
                    hideLoader();
                    alert('❌ Error al generar el PDF: ' + err.message);
                    reject(err);
                });
            });
        }

        async function addLogToQuote(quoteNumber, action) {
            const quotes = getQuotes();
            const idx = quotes.findIndex(q => q.quoteNumber === quoteNumber);
            if (idx !== -1) {
                if (!quotes[idx].logs) quotes[idx].logs = [];
                quotes[idx].logs.push({ action, by: currentUser, date: new Date().toISOString() });
                await saveQuotes(quotes);
            }
        }

        function downloadPdfFile(file) {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        function generateAndDownloadPDF(showAlert = true) {
            if (!lastQuoteData) {
                alert('Primero genere un presupuesto.');
                return Promise.reject('No hay cotización');
            }
            return buildPdfFile().then(async (file) => {
                downloadPdfFile(file);
                await addLogToQuote(lastQuoteData.quoteNumber, 'downloaded_pdf');
                if (showAlert) {
                    alert('✅ Presupuesto guardado y descargado exitosamente.');
                }
            });
        }

        // ================================================================
        //  ENVÍO POR WHATSAPP WEB
        // ================================================================

        async function sendWhatsApp() {
            if (!lastQuoteData) { alert('Genere una cotización primero.'); return; }
            const phone = (lastQuoteData.phone || '').replace(/[^0-9+]/g, '');
            const cleanPhone = phone.replace(/\D/g, '');
            if (!cleanPhone) {
                alert('El cliente no tiene un número de teléfono válido.');
                return;
            }
            const client = lastQuoteData.client || 'Cliente';
            const total = lastQuoteData.total.toFixed(2);
            const procedure = lastQuoteData.procedure;
            const signature = getSignature();
            const msg =
                `Hola ${client}, te comparto el presupuesto para "${procedure}" con un total de $${total} USD.\n\n${signature}`;

            const markSent = confirm('¿Marcar esta cotización como ENVIADA en el historial?');

            const whatsappWindow = window.open('about:blank', '_blank');
            try {
                const file = await buildPdfFile();
                if (markSent) {
                    const quotes = getQuotes();
                    const idx = quotes.findIndex(q => q.quoteNumber === lastQuoteData.quoteNumber);
                    if (idx !== -1) {
                        quotes[idx].status = 'enviada';
                        if (!quotes[idx].logs) quotes[idx].logs = [];
                        quotes[idx].logs.push({ action: 'sent_whatsapp', by: currentUser, date: new Date().toISOString() });
                        await saveQuotes(quotes);
                        lastQuoteData.status = 'enviada';
                    }
                }
                downloadPdfFile(file);
                const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(msg + ' Te adjunto el PDF a continuación.')}`;
                if (whatsappWindow) whatsappWindow.location = url;
                else window.open(url, '_blank');
                alert('📎 El PDF se descargó. Abre WhatsApp Web y adjunta el archivo desde tus descargas en el chat que se abrió.');
            } catch (error) {
                whatsappWindow?.close();
                alert('No se pudo preparar el envío: ' + error.message);
            }
        }

        async function sendFollowUpReminder(quoteNumber) {
            const quotes = getQuotes();
            const q = quotes.find(q => q.quoteNumber === quoteNumber);
            if (!q) { alert('Cotización no encontrada.'); return; }

            const client = q.client || 'Cliente';
            const total = q.total.toFixed(2);
            const procedure = q.procedure;
            const signature = getSignature();
            const msg =
                `Hola ${client}, te recordamos el presupuesto para "${procedure}" con un total de $${total} USD. ¿Te gustaría avanzar con el trámite?\n\n${signature}`;

            const phone = (q.phone || '').replace(/[^0-9+]/g, '');
            const cleanPhone = phone.replace(/\D/g, '');
            if (!cleanPhone) {
                alert('El cliente no tiene número de teléfono.');
                return;
            }
            const whatsappWindow = window.open('about:blank', '_blank');
            try {
                const idx = quotes.findIndex(q => q.quoteNumber === quoteNumber);
                if (idx !== -1) {
                    quotes[idx].reminderSent = true;
                    if (!quotes[idx].logs) quotes[idx].logs = [];
                    quotes[idx].logs.push({ action: 'reminder_prepared', by: currentUser, date: new Date().toISOString() });
                    await saveQuotes(quotes);
                }
                const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(msg)}`;
                if (whatsappWindow) whatsappWindow.location = url;
                else window.open(url, '_blank');
                alert('📨 Se abrió WhatsApp Web con el recordatorio preparado. Confirma el envío allí.');
            } catch (error) {
                whatsappWindow?.close();
                alert('No se pudo registrar el recordatorio: ' + error.message);
            }
        }

        // ================================================================
        //  SEGUIMIENTO (MODAL)
        // ================================================================

        function openFollowUp() {
            const quotes = getQuotes();
            const now = new Date();
            const threshold = new Date(now);
            threshold.setDate(threshold.getDate() - 7);

            const pendingOld = quotes.filter(q => {
                const date = new Date(q.date);
                return q.status === 'pendiente' && date < threshold && !q.reminderSent;
            });

            const tbody = document.getElementById('followUpBody');
            tbody.innerHTML = '';
            if (pendingOld.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">✅ No hay cotizaciones pendientes antiguas.</td></tr>';
            } else {
                pendingOld.forEach(q => {
                    const days = Math.floor((now - new Date(q.date)) / (1000 * 60 * 60 * 24));
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                <td>${escapeHtml(q.quoteNumber)}</td>
                                <td>${escapeHtml(q.client)}</td>
                                <td>${escapeHtml(q.procedure)}</td>
                                <td>${days} días</td>
                <td><button class="btn-sm follow-up-send" data-quote="${escapeHtml(q.quoteNumber)}" style="background:#25D366;color:white;border:none;border-radius:6px;padding:0.3rem 0.8rem;">📨 Enviar recordatorio (WhatsApp Web)</button></td>
                            `;
                    tbody.appendChild(tr);
                });
                document.querySelectorAll('.follow-up-send').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const qNumber = this.dataset.quote;
                        sendFollowUpReminder(qNumber).then(openFollowUp).catch(error => alert('No se pudo abrir el recordatorio: ' + error.message));
                    });
                });
            }
            document.getElementById('followUpModal').classList.add('active');
        }

        function closeFollowUp() {
            document.getElementById('followUpModal').classList.remove('active');
        }

        // ================================================================
        //  VISTA PREVIA DEL PDF
        // ================================================================

        function openPreview() {
            if (!lastQuoteData) { alert('Genere una cotización primero.'); return; }
            showLoader('Generando vista previa…');
            buildPdfFile().then((file) => {
                hideLoader();
                const url = URL.createObjectURL(file);
                const iframe = document.getElementById('previewIframe');
                iframe.src = url;
                document.getElementById('previewModal').classList.add('active');
                const closeHandler = function() {
                    if (iframe.src) URL.revokeObjectURL(iframe.src);
                    iframe.src = 'about:blank';
                    document.getElementById('closePreviewBtn').removeEventListener('click', closeHandler);
                };
                document.getElementById('closePreviewBtn').addEventListener('click', closeHandler);
            }).catch(() => {
                hideLoader();
            });
        }

        function closePreview() {
            document.getElementById('previewModal').classList.remove('active');
        }

        function downloadFromPreview() {
            generateAndDownloadPDF(true)
                .then(() => closePreview())
                .catch(() => {});
        }

        // ================================================================
        //  BUZÓN DE SUGERENCIAS
        // ================================================================

        function renderSuggestions() {
            const suggestions = getSuggestions();
            const list = document.getElementById('suggestionList');
            list.innerHTML = '';
            if (suggestions.length === 0) {
                list.innerHTML = '<p>No hay sugerencias aún.</p>';
                return;
            }
            suggestions.slice().reverse().forEach(s => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `
                            <div><strong>${escapeHtml(s.name || 'Anónimo')}</strong> ${s.email ? '&lt;' + escapeHtml(s.email) + '&gt;' : ''}</div>
                            <div>${escapeHtml(s.message)}</div>
                            <div class="meta">${new Date(s.timestamp).toLocaleString()}</div>
                        `;
                list.appendChild(div);
            });
        }

        function checkProgrammerAccess() {
            const area = document.getElementById('programmerArea');
            if (currentAuthRole === 'ADMIN') {
                area.style.display = 'block';
                renderSuggestions();
            } else {
                area.style.display = 'none';
            }
        }

        // ================================================================
        //  CONFIGURACIÓN (MODO OSCURO, AYUDA)
        // ================================================================

        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('sqp_darkMode', isDark ? 'true' : 'false');
            document.getElementById('darkModeToggle').textContent = isDark ? '☀️' : '🌙';
        }

        function openHelpModal() {
            document.getElementById('helpModal').classList.add('active');
            if (currentAuthRole === 'ADMIN') {
                renderSuggestions();
            }
        }

        function closeHelpModal() {
            document.getElementById('helpModal').classList.remove('active');
        }

        // ================================================================
        //  MOSTRAR APLICACIÓN PRINCIPAL
        // ================================================================

        function showApp() {
            if (!currentUser) {
                console.error('❌ No hay usuario actual.');
                return;
            }
            const mainApp = document.getElementById('mainApp');
            mainApp.style.display = 'block';
            mainApp.style.transform = 'scale(1)';
            mainApp.style.opacity = '1';
            const roleLabel = currentAuthRole === 'ADMIN' ? 'Administrador' : currentAuthRole === 'SUPERVISOR' ? 'Supervisor' : currentAuthRole === 'VIEWER' ? 'Solo lectura' : 'Ejecutivo';
            document.getElementById('currentUserDisplay').textContent = `${currentUser} (${roleLabel})`;
            const canManageQuotes = ['ADMIN', 'SUPERVISOR'].includes(currentAuthRole);
            document.getElementById('adminDashboardBtn').style.display = canManageQuotes ? 'inline-flex' : 'none';
            document.getElementById('adminHistoryBtn').style.display = canManageQuotes ? 'inline-flex' : 'none';
            document.getElementById('adminUsersBtn').style.display = currentAuthRole === 'ADMIN' ? 'inline-flex' : 'none';
            document.getElementById('templatesBtn').style.display = currentAuthRole === 'VIEWER' ? 'none' : 'inline-flex';
            updateProfilePic();
            resetForm();
            if (currentAuthRole === 'VIEWER') document.getElementById('formSection').style.display = 'none';
            if (localStorage.getItem('sqp_darkMode') === 'true') {
                document.body.classList.add('dark-mode');
                document.getElementById('darkModeToggle').textContent = '☀️';
            }
            const logoSvg = document.getElementById('sqpLogoSvg');
            if (logoSvg) {
                const faviconSvg = logoSvg.cloneNode(true);
                faviconSvg.removeAttribute('id');
                faviconSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                faviconSvg.setAttribute('viewBox', faviconSvg.getAttribute('viewBox') || '0 0 200 200');
                const svgText = new XMLSerializer().serializeToString(faviconSvg);
                document.getElementById('faviconLink').href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
            }
            getPdfLogoDataUri().then((dataUri) => {
                document.getElementById('pdfLogoImg').src = dataUri;
            }).catch(() => {});
            checkProgrammerAccess();
            usageReport.refreshAccess();

            // Cargar procedimientos desde data/procedures.json (opcional)
            fetch('data/procedures.json')
                .then(res => res.json())
                .then(data => {
                    const datalist = document.getElementById('proceduresList');
                    datalist.innerHTML = '';
                    data.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p;
                        datalist.appendChild(opt);
                    });
                })
                .catch(() => console.warn('No se pudo cargar procedures.json, usando lista por defecto.'));
        }

        // ================================================================
        //  EVENTOS PRINCIPALES
        // ================================================================

        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Aplicación iniciada (v5 - todo en un solo archivo)');

            // ---- LOGIN ----
            document.getElementById('loginBtn').addEventListener('click', handleLogin);
            document.getElementById('loginPassword').addEventListener('keydown', event => { if(event.key==='Enter') { event.preventDefault(); handleLogin(); } });
            // ---- LOGOUT ----
            document.getElementById('logoutBtn').addEventListener('click', handleLogout);

            // ---- PERFIL ----
            document.getElementById('profileBtn').addEventListener('click', openProfileModal);
            document.getElementById('closeProfileBtn').addEventListener('click', closeProfileModal);
            document.getElementById('updateProfileBtn').addEventListener('click', updateProfile);
            document.getElementById('profileSignature').addEventListener('input', updateSignaturePreview);

            // ---- ADMIN ----
            document.getElementById('adminDashboardBtn').addEventListener('click', openDashboard);
            document.getElementById('closeDashboardBtn').addEventListener('click', closeDashboard);
            document.getElementById('adminHistoryBtn').addEventListener('click', openHistoryModal);
            document.getElementById('closeHistoryBtn').addEventListener('click', closeHistoryModal);
            document.getElementById('adminUsersBtn').addEventListener('click', openUsersModal);
            document.getElementById('closeUsersBtn').addEventListener('click', closeUsersModal);
            document.getElementById('addUserBtn').addEventListener('click', addUser);
            document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
            document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
            document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);

            // ---- PLANTILLAS ----
            document.getElementById('templatesBtn').addEventListener('click', openTemplatesModal);
            document.getElementById('closeTemplatesBtn').addEventListener('click', closeTemplatesModal);
            document.getElementById('saveTemplateBtn').addEventListener('click', saveCurrentTemplate);

            // ---- MODO OSCURO ----
            document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

            // ---- SEGUIMIENTO ----
            document.getElementById('followUpBtn').addEventListener('click', openFollowUp);
            document.getElementById('closeFollowUpBtn').addEventListener('click', closeFollowUp);

            // ---- AYUDA ----
            document.getElementById('helpBtn').addEventListener('click', openHelpModal);
            document.getElementById('closeHelpBtn').addEventListener('click', closeHelpModal);

            // ---- CERRAR MODALES CON CLICK FUERA ----
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.addEventListener('click', function(e) {
                    if (e.target === this) this.classList.remove('active');
                });
            });

            // ---- VERIFICAR SESIÓN ----
            document.getElementById('loginScreen').style.display = 'block';
            document.getElementById('mainApp').style.display = 'none';
            resumeSharedSession().then(ok => {
                if (ok) { document.getElementById('loginScreen').style.display='none'; showApp(); }
                else document.getElementById('loginError').textContent='Inicia sesión con tu correo electrónico y contraseña.';
            }).catch(err => { console.error(err); document.getElementById('loginError').textContent=err.message||'Error al validar la cuenta.'; });

            // ---- CONSTRUIR LISTAS ----
            buildServicesList();
            buildRequirementsList();

            // ---- VALIDAR TELÉFONO ----
            document.getElementById('clientPhone').addEventListener('input', function(e) {
                this.value = this.value.replace(/[^0-9+]/g, '');
            });

            // ---- AUTO-SELECCIONAR REQUISITOS ----
            document.getElementById('procedureSearch').addEventListener('change', function() {
                autoSelectRequirements(this.value);
            });
            document.getElementById('procedureSearch').addEventListener('input', function() {
                const options = document.getElementById('proceduresList').options;
                for (let opt of options) {
                    if (opt.value === this.value) {
                        autoSelectRequirements(this.value);
                        break;
                    }
                }
            });

            // ---- GENERAR COTIZACIÓN (con resumen) ----
            document.getElementById('generateQuote').addEventListener('click', showSummary);
            document.getElementById('confirmGenerateBtn').addEventListener('click', () => confirmGenerate().catch(err => { console.error(err); alert('No se pudo guardar la cotización en Supabase: '+(err.message||'error desconocido')); }));
            document.getElementById('cancelGenerateBtn').addEventListener('click', cancelGenerate);

            // ---- EDITAR Y NUEVO ----
            document.getElementById('editQuote').addEventListener('click', function() {
                if (lastQuoteData) {
                    if (!confirm(
                            `¿Editar la cotización ${lastQuoteData.quoteNumber}? Los cambios se aplicarán al regenerar.`)) {
                        return;
                    }
                }
                document.getElementById('formSection').style.display = 'block';
                document.getElementById('quoteResult').classList.remove('active');
            });
            document.getElementById('newQuote').addEventListener('click', resetForm);

            // ---- ACCIONES DEL RESULTADO ----
            document.getElementById('whatsappBtn').addEventListener('click', sendWhatsApp);
            document.getElementById('previewPdfBtn').addEventListener('click', openPreview);
            document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
            document.getElementById('downloadPdfFromPreview').addEventListener('click', downloadFromPreview);

            // ---- BUZÓN DE SUGERENCIAS ----
            document.getElementById('suggestionForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                const message = document.getElementById('suggestionMessage').value.trim();
                if (!message) {
                    alert('Por favor escribe un mensaje.');
                    return;
                }
                const name = document.getElementById('suggestionName').value.trim() || 'Anónimo';
                const email = document.getElementById('suggestionEmail').value.trim() || '';
                const suggestions = getSuggestions();
                suggestions.push({
                    name: name,
                    email: email,
                    message: message,
                    timestamp: Date.now()
                });
                try {
                    await saveSuggestions(suggestions);
                } catch (error) {
                    document.getElementById('suggestionStatus').textContent = 'No se pudo guardar en la base de datos: ' + error.message;
                    return;
                }
                document.getElementById('suggestionMessage').value = '';
                document.getElementById('suggestionName').value = '';
                document.getElementById('suggestionEmail').value = '';
                document.getElementById('suggestionStatus').textContent = '✅ Sugerencia guardada, ¡gracias!';
                setTimeout(() => {
                    document.getElementById('suggestionStatus').textContent = '';
                }, 3000);
                if (currentAuthRole === 'ADMIN') {
                    renderSuggestions();
                }
            });

            document.getElementById('exportSuggestionsBtn')?.addEventListener('click', function() {
                const suggestions = getSuggestions();
                if (suggestions.length === 0) {
                    alert('No hay sugerencias para exportar.');
                    return;
                }
                const blob = new Blob([JSON.stringify(suggestions, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sugerencias_${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });

            document.getElementById('clearSuggestionsBtn')?.addEventListener('click', async function() {
                if (confirm('¿Borrar todas las sugerencias?')) {
                    try {
                        await saveSuggestions([]);
                        renderSuggestions();
                    } catch (error) {
                        alert('No se pudieron borrar las sugerencias: ' + error.message);
                    }
                }
            });

            console.log('✅ Aplicación lista.');
        });
    
