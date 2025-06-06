import { toast } from "sonner";
import { MessageSSE, MessageTypeSSE } from "../utils/types";
import { sleep } from "../utils/timer";

export const generateProof = async (birthYear: number) => {
  const BACKEND = "";
  let id;
  try {
    id = toast.loading("Configurando sessão...");
    const { UltraPlonkBackend } = await import("@aztec/bb.js");
    const { Noir } = await import("@noir-lang/noir_js");
    const res = await fetch("/circuit.json");
    
    const circuit = await res.json();
    const noir = new Noir(circuit);
    const backend = new UltraPlonkBackend(circuit.bytecode);

    toast.dismiss(id);
    toast.success("Sessão configurada");

    const { witness } = await noir.execute({
      birth_year: birthYear,
      current_year: 2025,
    });

    toast.success("Witness gerado");

    id = toast.loading("Gerando prova...");
    const { proof, publicInputs } = await backend.generateProof(witness);
    toast.dismiss(id);
    toast.success("Prova gerada");

    id = toast.loading("Gerando chave de verificação...");
    const vk = await backend.getVerificationKey();
    toast.dismiss(id);
    toast.success("Verificação de chave gerada");

    const eventSource = new EventSource(BACKEND);

    eventSource.onmessage = (event) => {
      const data: MessageSSE = JSON.parse(event.data);

      switch (data.type) {
        case MessageTypeSSE.INFO:
          toast.info(data.message);
          break;
        case MessageTypeSSE.SUCCESS:
          toast.success(data.message);
          break;
        case MessageTypeSSE.ERROR:
          toast.error(data.message);
          break;
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      toast.error("Conexão com servidor perdida");
    };

    toast.success("✅ Seus dados estão seguros 🔐");
    toast.loading("Submetendo prova para backend...");
    await sleep(2000);

    const result = await backend.verifyProof({proof, publicInputs})
    toast.success("Verify"+ result.toString())

    const response = await fetch(BACKEND, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          publicInputs: publicInputs[0],
          proof: Array.from(proof),
          vk: Array.from(vk),
      }),
    });

    toast.dismiss();
    toast.success("Prova enviada com sucesso!");
    if (!response.ok) {
      toast.dismiss();
      toast.error("Falha ao enviar prova");
      console.error(response.text)
    }

    eventSource.close();
  } catch (err: any) {
    toast.error("Erro ao gerar prova: " + err.message);
    console.error("💔 Proof generation failed:", err);
  }
};
