# Challenge runner implementacija

> Status: Proof of Concept

## Pokretanje testa

```bash
sudo ./scripts/install-k3s.sh
./scripts/deploy.sh
./scripts/status.sh
./scripts/smoke-test.sh
```

## Brisanje demo stvari

```bash
./scripts/remove-demo.sh
```

## File map

- `infra/k3s/config.yaml`: Specifične konfiguracije za k3s
- `infra/k8s/base/namespace.yaml`: demo namespace 
- `infra/k8s/base/http.yaml`: demo HTTP servis
- `infra/k8s/base/tcp.yaml`: demo TCP servis
