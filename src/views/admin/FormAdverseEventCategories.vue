<template>
<!--    <Dialog
        v-model:visible="createOrUpdatePopup"
        :style="{ width: '450px' }"
        :header="modalHeader"
        :modal="true"
        @hide="() => crud.goToParentRoute()"
    >
        <div v-if="loadingOnGetItem" class="card flex justify-center">
            <ProgressSpinner
                style="width: 50px; height: 50px"
                strokeWidth="3"
                fill="transparent"
                animationDuration="3s"
                aria-label="Custom ProgressSpinner"
            />
        </div>
        <Form
            v-else
            v-slot="$form"
            :initialValues="currentElement"
            :resolver="resolver"
            @submit="onFormSubmit"
            class="flex flex-col gap-4 w-full"
            :key="currentElement"
        >
            <div>
                <label for="name" class="block font-bold mb-3">Название</label>
                <InputText
                    id="name"
                    name="name"
                    v-model="currentElement.name"
                    fluid
                    :disabled="loadingOnConfirmModal"
                />
                <Message
                    class="mt-2"
                    v-if="$form.name?.invalid"
                    severity="error"
                    size="small"
                    variant="simple"
                    >{{ $form.name.error?.message }}</Message
                >
            </div>
            <div>
                <label for="description" class="block font-bold mb-3">Описание</label>
                <Textarea
                    id="description"
                    name="description"
                    v-model="currentElement.description"
                    rows="3"
                    cols="20"
                    fluid
                    :disabled="loadingOnConfirmModal"
                />
                <Message
                    class="mt-2"
                    v-if="$form.description?.invalid"
                    severity="error"
                    size="small"
                    variant="simple"
                    >{{ $form.description.error?.message }}</Message
                >
            </div>
            <div class="flex justify-end gap-3">
                <Button
                    label="Отмена"
                    icon="pi pi-times"
                    text
                    @click="() => crud.goToParentRoute()"
                    :disabled="loadingOnConfirmModal"
                />
                <Button
                    label="Сохранить"
                    icon="pi pi-check"
                    type="submit"
                    :loading="loadingOnConfirmModal"
                    :disabled="loadingOnConfirmModal"
                />
            </div>
        </Form>
    </Dialog>-->
</template>

<script setup>
/*import { storeToRefs } from 'pinia'
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { currentElement, createOrUpdatePopup, loadingOnGetItem, loadingOnConfirmModal } =
    storeToRefs(crud)

const eventCategories = useEventCategoriesStore()
const { getEventCategoryById, createEventCategory, updateEventCategory } = eventCategories

watchEffect(() => {
    const id = route.params.id // Получаем параметр id из маршрута
    console.log('route', route.params.id)
    if (id) {
        crud.getItemById(id, getEventCategoryById) // Вызов метода getItemById с параметрами
    } else {
        crud.createNew()
    }
})

const resolver = ({ values }) => {
    const errors = {}
    for (let [key, val] of Object.entries(values)) {
        if (!val) {
            errors[key] = [{ message: 'Поле обязательно для заполнения' }]
        }
    }

    return {
        values, // (Optional) Used to pass current form values to submit event.
        errors,
    }
}

const onFormSubmit = (submit) => {
    console.log('submit:', submit)
    if (submit.valid) {
        // crud.confirmCreateOrUpdate(createEventCategory, updateEventCategory);
    }
}

const modalHeader = computed(() => {
    if (loadingOnGetItem.value) {
        return 'Получение категории НС...'
    } else {
        if (currentElement.value.id) {
            return 'Редактировать категорию НС'
        } else {
            return 'Добавить категорию НС'
        }
    }
})*/
</script>

<style lang="scss" scoped></style>

