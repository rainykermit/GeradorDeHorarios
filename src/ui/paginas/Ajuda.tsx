import { Botao, CabecalhoPagina } from '../comum';
import { irPara } from '../navegacao';
import { abrirExemplo } from '../acoesFicheiro';

export function PaginaAjuda() {
  return (
    <div class="pagina">
      <CabecalhoPagina
        titulo="Ajuda"
        descricao="Tudo o que precisa de saber para fazer os horários da sua escola."
        acoes={
          <Botao icone="estrela" onClick={abrirExemplo}>
            Experimentar com a escola de exemplo
          </Botao>
        }
      />
      <div class="ajuda-texto">
        <h2 style={{ marginTop: 0 }}>Primeiros passos</h2>
        <ol>
          <li>
            <strong>Escola e horário</strong> — escreva o nome da escola e crie os tempos letivos (há um botão para os criar automaticamente). Marque, se
            quiser, os tempos em que ninguém pode ter aulas (por exemplo, a tarde de reuniões).
          </li>
          <li>
            <strong>Disciplinas</strong> — use «Disciplinas habituais» para as adicionar todas de uma vez. Indique as que precisam de uma sala especial
            (laboratório, pavilhão…).
          </li>
          <li>
            <strong>Salas</strong> — registe os espaços que quer controlar. No pavilhão pode indicar quantas turmas cabem em simultâneo.
          </li>
          <li>
            <strong>Docentes</strong> — adicione os docentes e marque as indisponibilidades de cada um (ou importe as fichas que eles preencheram).
          </li>
          <li>
            <strong>Turmas</strong> — crie as turmas (ex.: 5.º A a 5.º D de uma vez) com o plano curricular sugerido, escolha o diretor de turma e o docente
            de cada disciplina.
          </li>
          <li>
            <strong>Aulas</strong> — confirme a distribuição de serviço. Todas as aulas devem ter docente.
          </li>
          <li>
            <strong>Regras</strong> — normalmente não é preciso mudar nada.
          </li>
          <li>
            <strong>Gerar horário</strong> — a aplicação verifica os dados, avisa se algo estiver errado e cria o horário.
          </li>
          <li>
            <strong>Ver e editar horários</strong> — consulte por turma, docente ou sala, faça ajustes arrastando as aulas, imprima e exporte para Excel.
          </li>
        </ol>

        <h2>Conceitos</h2>
        <details open>
          <summary>Tempos e distribuição semanal («2+1»)</summary>
          <p>
            Um <strong>tempo</strong> é uma unidade do horário (por exemplo, 50 minutos). A distribuição indica como os tempos de uma disciplina se
            distribuem na semana: <strong>1+1+1</strong> são três aulas de um tempo em dias diferentes; <strong>2+1</strong> é um bloco de dois tempos
            seguidos (100 minutos) e mais uma aula de um tempo.
          </p>
        </details>
        <details>
          <summary>Turnos (desdobramentos)</summary>
          <p>
            Quando uma turma se divide — por exemplo, Ciências Naturais no laboratório só com metade da turma — crie a aula com o turno «Turno 1». A outra
            metade fica com «Turno 2». Aulas de turnos diferentes da mesma turma podem acontecer à mesma hora.
          </p>
        </details>
        <details>
          <summary>Aulas simultâneas (ex.: Francês e Espanhol)</summary>
          <p>
            Dê o mesmo nome de «grupo simultâneo» às aulas que devem ser sempre à mesma hora. Exemplo: Francês do 7.º A (turno «Francês») e Espanhol do 7.º A
            (turno «Espanhol»), ambas no grupo «LE II 7.º A». As aulas do grupo devem ter a mesma distribuição (ex.: 1+1+1).
          </p>
        </details>
        <details>
          <summary>Várias turmas ou vários docentes na mesma aula</summary>
          <p>
            Numa aula pode escolher várias turmas (ex.: EMRC com alunos de duas turmas) e vários docentes (ex.: par pedagógico, coadjuvação ou uma reunião).
            Aulas sem turma e só com docentes servem para horas como o atendimento aos encarregados de educação ou reuniões de departamento.
          </p>
        </details>
        <details>
          <summary>Indisponível ou «evitar se possível»</summary>
          <p>
            <strong>Indisponível</strong> é uma regra obrigatória: nunca haverá aulas nesse tempo. <strong>Evitar se possível</strong> é uma preferência: o
            gerador tenta cumprir, mas pode não conseguir.
          </p>
        </details>
        <details>
          <summary>Furos</summary>
          <p>Um furo é um tempo livre entre duas aulas no mesmo dia. O tempo de almoço não conta como furo.</p>
        </details>

        <h2>Gerar e ajustar o horário</h2>
        <details open>
          <summary>O horário não ficou completo. O que faço?</summary>
          <p>
            Veja a lista de aulas por colocar na página «Ver e editar horários». As causas mais comuns são: docentes ou turmas com demasiadas
            indisponibilidades, salas especiais insuficientes, ou limites de tempos por dia muito apertados. Corrija os dados e gere de novo — ou coloque as
            aulas em falta à mão, arrastando-as para a grelha.
          </p>
          <p>Também pode escolher uma geração mais demorada: quanto mais tempo, melhor o resultado.</p>
        </details>
        <details>
          <summary>Mudar uma aula de sítio</summary>
          <p>
            Na página «Ver e editar horários», arraste a aula para outro tempo. Enquanto arrasta, a grelha mostra a <span style={{ color: 'var(--verde)' }}>verde</span> os
            tempos possíveis, a <span style={{ color: 'var(--ambar)' }}>amarelo</span> os possíveis mas não recomendados, a{' '}
            <span style={{ color: '#3a6fc4' }}>azul</span> as trocas possíveis com outra aula, e a <span style={{ color: 'var(--vermelho)' }}>vermelho</span> os tempos com conflito. Se largar
            a aula num tempo com conflito, a aplicação pergunta se quer retirar as aulas que estão no caminho.
          </p>
        </details>
        <details>
          <summary>Fixar aulas</summary>
          <p>
            Clique numa aula e escolha «Fixar». As aulas fixas não mudam de sítio quando gerar o horário de novo — é útil para garantir uma hora específica ou
            para melhorar só parte do horário.
          </p>
        </details>
        <details>
          <summary>Imprimir, PDF e Excel</summary>
          <p>
            Em «Ver e editar horários» use «Imprimir» para imprimir o horário escolhido ou todos (turmas, docentes ou salas), um por página. Para obter um PDF,
            escolha «Guardar como PDF» como impressora. «Exportar para Excel» cria um ficheiro com uma folha por turma, docente e sala, e um mapa geral.
          </p>
        </details>

        <h2>Os seus dados</h2>
        <details>
          <summary>Onde ficam guardados os dados?</summary>
          <p>
            No seu computador. A aplicação guarda automaticamente o trabalho enquanto trabalha. Nada é enviado para a Internet. Para ter uma cópia de
            segurança, use o botão «Guardar», que cria um ficheiro «.horario».
          </p>
        </details>
        <details>
          <summary>Como continuar o trabalho noutro computador?</summary>
          <p>
            Carregue em «Guardar» para criar o ficheiro, copie-o (por e-mail, pen USB…) e, no outro computador, abra o Gerador de Horários e carregue em
            «Abrir».
          </p>
        </details>
        <details>
          <summary>Como recolher as indisponibilidades dos docentes?</summary>
          <p>
            Na página «Docentes», carregue em «Criar ficha para docentes» e envie o ficheiro por e-mail. Cada docente abre o Gerador de Horários, escolhe
            «Abrir a ficha para docentes» na página Início, preenche e devolve-lhe a ficha. Depois, use «Importar fichas».
          </p>
          <Botao pequeno icone="ficha" onClick={() => irPara('ficha')}>
            Ver a ficha de disponibilidade
          </Botao>
        </details>

        <h2>Sobre</h2>
        <p>
          O Gerador de Horários foi feito por{' '}
          <a href="https://github.com/rainykermit" target="_blank" rel="noopener noreferrer">
            rainykermit
          </a>
          . É gratuito e de código aberto (licença GNU GPL v3). O código e as novas versões estão em{' '}
          <a href="https://github.com/rainykermit/GeradorDeHorarios" target="_blank" rel="noopener noreferrer">
            github.com/rainykermit/GeradorDeHorarios
          </a>
          .
        </p>

        <h2>Atalhos de teclado</h2>
        <ul>
          <li>
            <span class="kbd">Ctrl</span> + <span class="kbd">S</span> — guardar em ficheiro
          </li>
          <li>
            <span class="kbd">Ctrl</span> + <span class="kbd">O</span> — abrir ficheiro
          </li>
          <li>
            <span class="kbd">Ctrl</span> + <span class="kbd">Z</span> — anular a última alteração
          </li>
          <li>
            <span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">Z</span> — refazer
          </li>
        </ul>
        <p class="texto-secundario">No Mac, use a tecla ⌘ em vez de Ctrl.</p>
      </div>
    </div>
  );
}
