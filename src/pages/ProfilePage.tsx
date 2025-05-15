import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Schemat walidacji dla formularza profilu
const profileFormSchema = z.object({
  first_name: z.string().min(2, {
    message: "Pseudonim musi mieć co najmniej 2 znaki.",
  }).max(50, {
    message: "Pseudonim nie może być dłuższy niż 50 znaków.",
  }),
});

// Schemat walidacji dla formularza zmiany hasła
const passwordFormSchema = z.object({
    password: z.string().min(6, {
        message: "Hasło musi mieć co najmniej 6 znaków.",
    }),
});


type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null; // Możemy zachować, ale skupiamy się na first_name jako pseudonimie
    wins: number;
    losses: number;
    desertions: number;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
      const fetchUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id || null);
      };
      fetchUser();
  }, []);


  // Fetch user profile
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<Profile>({
    queryKey: ["profile", currentUserId],
    queryFn: async () => {
      if (!currentUserId) throw new Error("User ID is not available");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUserId, // Zapytanie uruchomi się tylko gdy currentUserId jest dostępne
  });

  // Formularz edycji profilu
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      first_name: profile?.first_name || "",
    },
    values: { // Użyj values, aby formularz aktualizował się po załadowaniu danych profilu
        first_name: profile?.first_name || "",
    },
  });

  // Mutation do aktualizacji profilu
  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!currentUserId) throw new Error("User ID is not available");
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: values.first_name })
        .eq("id", currentUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] });
      toast.success("Profil zaktualizowany!");
    },
    onError: (err) => {
      toast.error(`Błąd podczas aktualizacji profilu: ${err.message}`);
    },
  });

  // Obsługa submitu formularza profilu
  const onSubmitProfile = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  // Formularz zmiany hasła
  const passwordForm = useForm<PasswordFormValues>({
      resolver: zodResolver(passwordFormSchema),
      defaultValues: {
          password: "",
      },
  });

  // Mutation do zmiany hasła
  const changePasswordMutation = useMutation({
      mutationFn: async (values: PasswordFormValues) => {
          const { error } = await supabase.auth.updateUser({
              password: values.password,
          });
          if (error) throw error;
      },
      onSuccess: () => {
          toast.success("Hasło zostało zmienione!");
          passwordForm.reset(); // Wyczyść formularz po sukcesie
      },
      onError: (err) => {
          toast.error(`Błąd podczas zmiany hasła: ${err.message}`);
      },
  });

  // Obsługa submitu formularza zmiany hasła
  const onSubmitPassword = (values: PasswordFormValues) => {
      changePasswordMutation.mutate(values);
  };


  if (isLoadingProfile) return <div>Ładowanie profilu...</div>;
  if (profileError) return <div>Wystąpił błąd podczas ładowania profilu: {profileError.message}</div>;
  if (!profile) return <div>Profil nie znaleziono.</div>;


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Mój Profil</h1>

      {/* Karta z edycją pseudonimu */}
      <Card className="mb-6 max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Edytuj Pseudonim</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4">
            <div>
              <Label htmlFor="first_name">Pseudonim</Label>
              <Input
                id="first_name"
                {...profileForm.register("first_name")}
                disabled={updateProfileMutation.isPending}
              />
              {profileForm.formState.errors.first_name && (
                <p className="text-red-500 text-sm mt-1">{profileForm.formState.errors.first_name.message}</p>
              )}
            </div>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? "Zapisywanie..." : "Zapisz Pseudonim"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Karta ze statystykami */}
      <Card className="mb-6 max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Statystyki Gier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-lg">Wygrane: <span className="font-semibold">{profile.wins}</span></p>
          <p className="text-lg">Przegrane: <span className="font-semibold">{profile.losses}</span></p>
          <p className="text-lg">Dezercje: <span className="font-semibold">{profile.desertions}</span></p>
        </CardContent>
      </Card>

      {/* Karta ze zmianą hasła */}
      <Card className="mb-6 max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Zmień Hasło</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
            <div>
              <Label htmlFor="password">Nowe Hasło</Label>
              <Input
                id="password"
                type="password"
                {...passwordForm.register("password")}
                disabled={changePasswordMutation.isPending}
              />
              {passwordForm.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Zmienianie..." : "Zmień Hasło"}
            </Button>
          </form>
        </CardContent>
      </Card>

       {/* Przycisk powrotu */}
       <div className="text-center mt-6">
            <Button variant="outline" onClick={() => navigate('/game-modes')}>Powrót do Wyboru Trybu</Button>
       </div>

    </div>
  );
};

export default ProfilePage;