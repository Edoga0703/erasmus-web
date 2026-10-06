import { createFileRoute } from "@tanstack/react-router";
import { Database, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad — Erasmus" },
      { name: "description", content: "Cómo Erasmus trata y protege los datos de sus usuarios." },
      { property: "og:title", content: "Política de privacidad — Erasmus" },
      { property: "og:description", content: "Cómo Erasmus trata y protege los datos de sus usuarios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

type Copy = {
  label: string;
  title: string;
  intro: string;
  updated: string;
  summary: { title: string; text: string; icon: typeof Database }[];
  sections: { title: string; paragraphs: string[]; bullets?: string[] }[];
  notice: string;
};

const COPY: Record<"es" | "en" | "pt", Copy> = {
  es: {
    label: "Privacidad",
    title: "Tus datos, explicados sin rodeos",
    intro: "Esta política describe qué información necesita Erasmus para funcionar, cómo se utiliza y qué control tienes sobre ella.",
    updated: "Última actualización: 6 de octubre de 2026",
    summary: [
      { title: "No vendemos datos", text: "Tus datos no se venden ni se usan para publicidad o perfiles comerciales.", icon: EyeOff },
      { title: "Conservación limitada", text: "Conversaciones y archivos se conservan durante un máximo de 30 días.", icon: Database },
      { title: "Acceso protegido", text: "Cada cuenta usa un código y un espacio separado de las demás.", icon: LockKeyhole },
    ],
    sections: [
      { title: "1. Responsable y alcance", paragraphs: ["Erasmus es un servicio operado desde Venezuela. La identificación legal completa del responsable se incorporará antes de su explotación comercial. Esta política se aplica al sitio público, al acceso mediante código y al espacio privado de conversación."] },
      { title: "2. Información que tratamos", paragraphs: ["Tratamos únicamente la información necesaria para prestar el servicio y protegerlo."], bullets: ["Código de acceso, identificador interno, plan y vigencia de la sesión.", "Prompts, respuestas, razonamiento mostrado, conversaciones y preferencias que decidas guardar.", "Archivos, imágenes y documentos que adjuntes, junto con los resultados generados.", "Clave de acceso al modelo que introduzcas: permanece en la sesión del navegador y se envía para atender tus solicitudes; no se muestra completa.", "Datos técnicos mínimos, como fecha, estado de la solicitud, dirección IP y señales de seguridad, cuando el servidor los necesite para prevenir abuso, investigar fallos o cumplir obligaciones legales."] },
      { title: "3. Lo que no te pedimos", paragraphs: ["No necesitas correo electrónico, nombre, número telefónico ni una cuenta social para entrar. No usamos rastreadores publicitarios ni creamos perfiles para mostrar anuncios. Evita incluir datos personales o confidenciales que no sean necesarios para tu solicitud."] },
      { title: "4. Para qué usamos la información", paragraphs: ["Usamos los datos para autenticar tu acceso, responder solicitudes, conservar temporalmente tu historial, procesar adjuntos, generar resultados, mantener la continuidad de la conversación, prevenir fraude y abuso, diagnosticar problemas y proteger el servicio.", "No utilizamos tus conversaciones para entrenar modelos ni para crear productos publicitarios. Cualquier uso distinto requerirá actualizar esta política y, cuando corresponda, solicitar autorización."] },
      { title: "5. Cómo funciona el procesamiento con IA", paragraphs: ["Para producir una respuesta, el contenido que envías y el contexto necesario de la conversación se transmiten al servicio de modelo conectado a Erasmus. Sus proveedores de infraestructura pueden procesar esos datos exclusivamente para entregar y proteger el servicio.", "Erasmus puede resumir automáticamente conversaciones extensas para mantenerlas dentro del límite técnico del modelo. Ese resumen pasa a formar parte del contexto de la conversación."] },
      { title: "6. Almacenamiento y conservación", paragraphs: ["Las conversaciones y los archivos se conservarán durante un máximo de 30 días y después deberán eliminarse automáticamente del servidor. Una solicitud de eliminación puede acelerar ese proceso, salvo que exista una obligación legal o un registro mínimo de seguridad que deba conservarse.", "La sesión y la clave del modelo se guardan en el almacenamiento temporal del navegador. Al cerrar sesión se eliminan los datos locales asociados a la cuenta; cerrar solo la ventana no equivale necesariamente a borrar los datos del servidor."] },
      { title: "7. Seguridad y límites del cifrado", paragraphs: ["Utilizamos conexión cifrada HTTPS, sesiones separadas y controles de acceso para reducir el riesgo de acceso no autorizado. Las claves no se muestran completas y no deben incluirse en mensajes o archivos.", "El servicio no ofrece cifrado de extremo a extremo: el sistema y sus proveedores necesitan procesar el contenido para generar respuestas, prestar soporte, investigar incidentes o cumplir la ley. Ningún sistema conectado a internet puede garantizar seguridad absoluta."] },
      { title: "8. Quién puede recibir datos", paragraphs: ["El acceso se limita al personal autorizado y a proveedores estrictamente necesarios para alojamiento, entrega de contenido, seguridad y procesamiento de IA. Cada proveedor debe recibir solo la información necesaria para su función. No cedemos información a anunciantes ni corredores de datos.", "Podremos revelar información si una autoridad competente lo exige legalmente, o cuando sea necesario para prevenir daños, fraude o ataques contra Erasmus y sus usuarios."] },
      { title: "9. Tus derechos y opciones", paragraphs: ["Puedes solicitar acceso, corrección, exportación o eliminación de tus datos, así como oponerte o pedir una limitación cuando la legislación aplicable lo permita. Nunca envíes tu código completo para identificarte en una solicitud.", "El canal de privacidad por Telegram se publicará cuando esté disponible. Hasta entonces, esta página se actualizará antes de que el servicio se ofrezca comercialmente."] },
      { title: "10. Menores", paragraphs: ["Erasmus no está dirigido a menores de edad. Si descubrimos que se han enviado datos de un menor sin autorización válida, procuraremos eliminarlos."] },
      { title: "11. Cambios en esta política", paragraphs: ["Podemos actualizar esta política para reflejar cambios del servicio, proveedores o requisitos legales. La fecha superior indicará la versión vigente y los cambios importantes se comunicarán de forma visible."] },
    ],
    notice: "Texto informativo pendiente de revisión legal profesional antes del lanzamiento comercial.",
  },
  en: {
    label: "Privacy",
    title: "Your data, explained clearly",
    intro: "This policy explains what Erasmus needs to operate, how information is used, and the control you have over it.",
    updated: "Last updated: October 6, 2026",
    summary: [
      { title: "We do not sell data", text: "Your data is not sold or used for advertising or commercial profiling.", icon: EyeOff },
      { title: "Limited retention", text: "Conversations and files are retained for no more than 30 days.", icon: Database },
      { title: "Protected access", text: "Each account uses a code and a space separated from every other account.", icon: LockKeyhole },
    ],
    sections: [
      { title: "1. Controller and scope", paragraphs: ["Erasmus is a service operated from Venezuela. The controller's complete legal identity will be added before commercial operation. This policy applies to the public site, code-based access, and the private conversation space."] },
      { title: "2. Information we process", paragraphs: ["We process only the information needed to provide and protect the service."], bullets: ["Access code, internal identifier, plan, and session validity.", "Prompts, responses, displayed reasoning, conversations, and preferences you choose to save.", "Files, images, and documents you attach, together with generated results.", "The model access key you enter remains in the browser session and is sent to fulfill requests; it is never displayed in full.", "Minimal technical data such as time, request status, IP address, and security signals when needed to prevent abuse, investigate failures, or meet legal obligations."] },
      { title: "3. What we do not ask for", paragraphs: ["You do not need an email address, name, telephone number, or social account to sign in. We do not use advertising trackers or build advertising profiles. Avoid including personal or confidential information that is not necessary for your request."] },
      { title: "4. Why we use information", paragraphs: ["We use data to authenticate access, answer requests, temporarily retain history, process attachments, generate results, maintain conversation continuity, prevent fraud and abuse, diagnose problems, and protect the service.", "We do not use conversations to train models or build advertising products. Any different use will require an updated policy and, where applicable, consent."] },
      { title: "5. AI processing", paragraphs: ["To produce a response, your content and the necessary conversation context are transmitted to the model service connected to Erasmus. Infrastructure providers may process that data solely to deliver and secure the service.", "Erasmus may automatically summarize long conversations to remain within the model's technical limits. That summary becomes part of the conversation context."] },
      { title: "6. Storage and retention", paragraphs: ["Conversations and files will be retained for no more than 30 days and must then be automatically deleted from the server. A deletion request may accelerate this process, except where a legal obligation or minimal security record must be retained.", "The session and model key are stored in temporary browser storage. Signing out removes local account data; simply closing the window does not necessarily delete server data."] },
      { title: "7. Security and encryption limits", paragraphs: ["We use encrypted HTTPS connections, separated sessions, and access controls to reduce unauthorized access. Keys are not displayed in full and should never be included in messages or files.", "The service is not end-to-end encrypted: the system and its providers must process content to generate responses, provide support, investigate incidents, or comply with law. No internet-connected system can guarantee absolute security."] },
      { title: "8. Who may receive data", paragraphs: ["Access is limited to authorized personnel and providers strictly necessary for hosting, delivery, security, and AI processing. Each provider should receive only what is required for its role. We do not disclose information to advertisers or data brokers.", "We may disclose information when legally required by a competent authority, or when necessary to prevent harm, fraud, or attacks against Erasmus and its users."] },
      { title: "9. Your rights and choices", paragraphs: ["You may request access, correction, export, or deletion, and object or request restriction where applicable law allows. Never send your complete access code to identify yourself in a request.", "The Telegram privacy channel will be published when available. This page will be updated before commercial availability."] },
      { title: "10. Children", paragraphs: ["Erasmus is not intended for minors. If we learn that a minor's data was submitted without valid authorization, we will seek to delete it."] },
      { title: "11. Policy changes", paragraphs: ["We may update this policy as the service, providers, or legal requirements change. The date above identifies the current version and material changes will be announced visibly."] },
    ],
    notice: "Informational text pending professional legal review before commercial launch.",
  },
  pt: {
    label: "Privacidade",
    title: "Seus dados, explicados com clareza",
    intro: "Esta política explica quais informações o Erasmus precisa para funcionar, como são utilizadas e qual controle você tem sobre elas.",
    updated: "Última atualização: 6 de outubro de 2026",
    summary: [
      { title: "Não vendemos dados", text: "Seus dados não são vendidos nem usados para publicidade ou perfis comerciais.", icon: EyeOff },
      { title: "Retenção limitada", text: "Conversas e arquivos são mantidos por no máximo 30 dias.", icon: Database },
      { title: "Acesso protegido", text: "Cada conta usa um código e um espaço separado das demais.", icon: LockKeyhole },
    ],
    sections: [
      { title: "1. Responsável e alcance", paragraphs: ["Erasmus é um serviço operado a partir da Venezuela. A identificação jurídica completa do responsável será incluída antes da operação comercial. Esta política se aplica ao site público, ao acesso por código e ao espaço privado de conversa."] },
      { title: "2. Informações que tratamos", paragraphs: ["Tratamos somente as informações necessárias para prestar e proteger o serviço."], bullets: ["Código de acesso, identificador interno, plano e validade da sessão.", "Prompts, respostas, raciocínio exibido, conversas e preferências que você decidir salvar.", "Arquivos, imagens e documentos anexados, junto com os resultados gerados.", "A chave de acesso ao modelo permanece na sessão do navegador e é enviada para atender às solicitações; nunca é exibida por completo.", "Dados técnicos mínimos, como horário, estado da solicitação, endereço IP e sinais de segurança, quando necessários para prevenir abuso, investigar falhas ou cumprir obrigações legais."] },
      { title: "3. O que não pedimos", paragraphs: ["Você não precisa de e-mail, nome, telefone ou conta social para entrar. Não usamos rastreadores publicitários nem criamos perfis para anúncios. Evite incluir dados pessoais ou confidenciais desnecessários."] },
      { title: "4. Para que usamos as informações", paragraphs: ["Usamos os dados para autenticar o acesso, responder solicitações, conservar temporariamente o histórico, processar anexos, gerar resultados, manter a continuidade da conversa, prevenir fraude e abuso, diagnosticar problemas e proteger o serviço.", "Não usamos conversas para treinar modelos nem criar produtos publicitários. Qualquer uso diferente exigirá atualização desta política e, quando aplicável, consentimento."] },
      { title: "5. Processamento por IA", paragraphs: ["Para produzir uma resposta, seu conteúdo e o contexto necessário da conversa são enviados ao serviço de modelo conectado ao Erasmus. Provedores de infraestrutura podem processar esses dados somente para entregar e proteger o serviço.", "Erasmus pode resumir automaticamente conversas longas para permanecer dentro dos limites técnicos do modelo. Esse resumo passa a fazer parte do contexto."] },
      { title: "6. Armazenamento e retenção", paragraphs: ["Conversas e arquivos serão mantidos por no máximo 30 dias e depois deverão ser excluídos automaticamente do servidor. Uma solicitação de exclusão pode antecipar o processo, salvo obrigação legal ou registro mínimo de segurança.", "A sessão e a chave do modelo ficam no armazenamento temporário do navegador. Sair remove os dados locais da conta; apenas fechar a janela não elimina necessariamente os dados do servidor."] },
      { title: "7. Segurança e limites da criptografia", paragraphs: ["Usamos conexões HTTPS criptografadas, sessões separadas e controles de acesso para reduzir acessos não autorizados. As chaves não são exibidas por completo e não devem ser incluídas em mensagens ou arquivos.", "O serviço não possui criptografia de ponta a ponta: o sistema e seus provedores precisam processar o conteúdo para gerar respostas, prestar suporte, investigar incidentes ou cumprir a lei. Nenhum sistema conectado à internet pode garantir segurança absoluta."] },
      { title: "8. Quem pode receber dados", paragraphs: ["O acesso é limitado a pessoal autorizado e provedores estritamente necessários para hospedagem, entrega, segurança e processamento por IA. Cada provedor deve receber somente o necessário. Não cedemos informações a anunciantes ou corretores de dados.", "Podemos revelar informações quando uma autoridade competente exigir legalmente, ou quando necessário para prevenir danos, fraude ou ataques contra o Erasmus e seus usuários."] },
      { title: "9. Seus direitos e opções", paragraphs: ["Você pode solicitar acesso, correção, exportação ou exclusão e, quando a lei aplicável permitir, oposição ou limitação. Nunca envie seu código de acesso completo para se identificar.", "O canal de privacidade pelo Telegram será publicado quando estiver disponível. Esta página será atualizada antes da oferta comercial."] },
      { title: "10. Menores", paragraphs: ["Erasmus não é destinado a menores. Se descobrirmos dados enviados sem autorização válida, procuraremos excluí-los."] },
      { title: "11. Mudanças nesta política", paragraphs: ["Podemos atualizar esta política para refletir mudanças no serviço, nos provedores ou nas exigências legais. A data acima indica a versão vigente e mudanças importantes serão comunicadas de forma visível."] },
    ],
    notice: "Texto informativo pendente de revisão jurídica profissional antes do lançamento comercial.",
  },
};

function PrivacyPage() {
  const lang = useLang();
  const copy = COPY[lang];
  return (
    <div className="min-h-dvh bg-e-bg2 text-e-tx">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-5 py-12 sm:py-20">
        <header className="max-w-3xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-e-dim">{copy.label}</p>
          <h1 className="mt-3 text-[36px] font-semibold leading-tight tracking-tight sm:text-[52px]">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-e-dim sm:text-[18px]">{copy.intro}</p>
          <p className="mt-4 text-[12px] text-e-dim">{copy.updated}</p>
        </header>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {copy.summary.map((item) => (
            <article key={item.title} className="rounded-2xl border border-e-line bg-e-bg3/45 p-5">
              <item.icon className="size-5 text-e-dim" />
              <h2 className="mt-4 text-[15px] font-semibold">{item.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-e-dim">{item.text}</p>
            </article>
          ))}
        </section>

        <div className="mt-14 divide-y divide-e-line border-y border-e-line">
          {copy.sections.map((section) => (
            <section key={section.title} className="grid gap-4 py-8 md:grid-cols-[240px_1fr] md:gap-10">
              <h2 className="text-[17px] font-semibold">{section.title}</h2>
              <div className="space-y-4 text-[14.5px] leading-7 text-e-dim">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul className="list-disc space-y-2 pl-5">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
              </div>
            </section>
          ))}
        </div>

        <aside className="mt-10 flex gap-3 rounded-2xl border border-e-line bg-e-bg3/45 p-5 text-[13px] leading-relaxed text-e-dim">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <p>{copy.notice}</p>
        </aside>
      </main>
    </div>
  );
}